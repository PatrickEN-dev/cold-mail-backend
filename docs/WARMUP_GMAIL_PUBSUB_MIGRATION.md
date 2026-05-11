# Warmup Recv: migração IMAP → Gmail Pub/Sub

> **Quando ler isso:** quando o IMAP polling do warmup recv (Onda 3) começar a ficar caro
> ou lento. Hoje rodamos IMAP por simplicidade, mas Pub/Sub é o caminho correto pra escala
> (latência ~segundos vs ~1min, ~0 custo de polling).

## TL;DR

| | IMAP (hoje) | Pub/Sub (futuro) |
|---|---|---|
| **Como funciona** | Backend conecta no Gmail a cada N segundos e procura emails novos | Gmail empurra uma notificação HTTP no backend quando chega email novo |
| **Latência** | 30s a 1min | ~5 segundos |
| **Custo** | Setup quase zero (só app password) | Setup chato: GCP project + topic + subscription + OAuth |
| **Permissões** | App Password ou OAuth básico | OAuth com escopo `gmail.readonly` ou `gmail.modify` |
| **Quem chama quem** | Backend → Gmail (pull) | Gmail → Backend (push) |
| **Falha silenciosa** | Se backend cair, polling para — alertável | Se backend cair, Gmail re-tenta entrega da notificação por 7 dias |

---

## Pré-requisitos antes de migrar

1. As 3 caixas Gmail do warmup (Abigail / Hanna / Emily) precisam estar dentro
   de um **Google Workspace** OU ter OAuth de aplicativo configurado.
2. Acesso a um projeto **Google Cloud** com billing ativo (Pub/Sub é gratuito até
   ~10GB/mês de mensagens, mas exige projeto com billing).
3. URL pública estável do backend (`BACKEND_PUBLIC_URL` configurada).
4. Onda 3 (warmup) já rodando estável com IMAP polling por **≥ 2 semanas**.

---

## Passo a passo completo

### 1. Criar projeto Google Cloud e ativar APIs

```bash
# Via gcloud CLI (ou Console Web)
gcloud projects create coldmail-warmup --name="Coldmail Warmup"
gcloud config set project coldmail-warmup
gcloud services enable pubsub.googleapis.com
gcloud services enable gmail.googleapis.com
gcloud services enable iamcredentials.googleapis.com
```

### 2. Criar tópico Pub/Sub que o Gmail vai usar

```bash
gcloud pubsub topics create coldmail-warmup-inbox
```

### 3. Dar permissão pro Gmail publicar no tópico

```bash
gcloud pubsub topics add-iam-policy-binding coldmail-warmup-inbox \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

> `gmail-api-push@system.gserviceaccount.com` é a service account oficial do Gmail —
> não precisa criar, ela já existe.

### 4. Criar subscription Push apontando pro backend

```bash
gcloud pubsub subscriptions create coldmail-warmup-inbox-sub \
  --topic=coldmail-warmup-inbox \
  --push-endpoint="https://api.coldmail.com/webhooks/gmail-pubsub" \
  --ack-deadline=60 \
  --message-retention-duration=7d \
  --push-auth-service-account=warmup-bot@coldmail-warmup.iam.gserviceaccount.com
```

> O `--push-auth-service-account` faz o Pub/Sub assinar cada push com um JWT
> do Google. O backend valida esse JWT antes de aceitar (proteção contra spoof).

### 5. OAuth nas 3 contas Gmail (uma vez por conta)

Pra cada caixa do warmup:

1. Acesse https://console.cloud.google.com/apis/credentials no projeto
2. Crie OAuth client ID tipo **Desktop / Other**
3. Baixe o `client_secret.json`
4. No backend, rode `pnpm gmail:authorize abigail.parker@gbestcleaning.info`
   (script auxiliar a criar — abre o browser, pede consentimento, salva refresh token)
5. Repita pras outras 2 caixas

> O refresh token vai pro Postgres (tabela nova `gmail_oauth_credentials`),
> nunca pro `.env`.

### 6. Cada caixa Gmail "se inscreve" no tópico (`users.watch`)

A cada **7 dias** (o watch expira), o backend renova o watch:

```http
POST https://gmail.googleapis.com/gmail/v1/users/{address}/watch
Authorization: Bearer <oauth_access_token>

{
  "labelIds": ["INBOX"],
  "topicName": "projects/coldmail-warmup/topics/coldmail-warmup-inbox"
}
```

Resposta inclui `historyId` que o backend guarda — é o cursor pra puxar
mudanças desde a última notificação.

### 7. Implementar handler no backend

```typescript
// src/modules/warmup/webhooks/gmail-pubsub.controller.ts
@Public()
@Post('/webhooks/gmail-pubsub')
@HttpCode(204)
async handle(@Req() req, @Body() body: { message: { data: string } }) {
  // 1. Validar JWT do Google que vem em Authorization
  await this.validateGoogleJwt(req.headers.authorization);

  // 2. Parse do payload (base64)
  const payload = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
  // payload = { emailAddress: "...", historyId: 12345 }

  // 3. Enfileirar processamento async (o Pub/Sub dá ack em 60s; processar
  //    inline pode estourar)
  await this.warmupQueue.add('gmail.process-notification', {
    address: payload.emailAddress,
    historyId: payload.historyId,
  });
}
```

### 8. Processador assíncrono que puxa as mudanças

```typescript
// src/modules/warmup/workers/gmail-history.processor.ts
@Processor(WARMUP_QUEUE)
async process(job: Job<{ address: string; historyId: number }>) {
  // 1. Pegar último historyId conhecido pra essa caixa
  const lastHistoryId = await this.gmailRepo.getLastHistoryId(job.data.address);

  // 2. Buscar histórico desde então
  const { history } = await gmail.users.history.list({
    userId: job.data.address,
    startHistoryId: lastHistoryId,
    historyTypes: ['messageAdded'],
  });

  // 3. Pra cada mensagem nova, processar (sender_warmups.applyReply)
  for (const item of history ?? []) {
    for (const msg of item.messagesAdded ?? []) {
      await this.applyWarmupReply(job.data.address, msg.message);
    }
  }

  // 4. Salvar novo historyId
  await this.gmailRepo.setLastHistoryId(job.data.address, job.data.historyId);
}
```

### 9. Cron de renovação do `users.watch`

```typescript
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async renewWatches() {
  for (const account of await this.gmailRepo.list()) {
    await this.refreshWatch(account);
  }
}
```

Gmail watch expira em **7 dias**. Rodar diariamente é seguro com folga.

### 10. Schema novo necessário

```sql
CREATE TABLE gmail_oauth_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address   text NOT NULL,
  refresh_token   text NOT NULL,        -- encrypted at rest (pgcrypto)
  scope           text NOT NULL,
  last_history_id bigint,
  watch_expires_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, email_address)
);

ALTER TABLE gmail_oauth_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant isolation" ON gmail_oauth_credentials
  USING ((SELECT auth.uid()) = user_id);
```

### 11. Cutover seguro

1. Deploy do backend com **dois** consumers ativos:
   - IMAP polling continua rodando (`ENABLE_IMAP_WARMUP=true`)
   - Pub/Sub handler novo ativo (`ENABLE_PUBSUB_WARMUP=true`)
2. **Idempotency**: cada `message_id` que chega é checado contra `email_warmup_interactions`. Duplicidades são ignoradas.
3. Verificar 3 dias que ambos os consumers estão produzindo o mesmo número de
   `interaction_type='reply'` por dia (`SELECT date_trunc('day', created_at), COUNT(*) FROM email_warmup_interactions WHERE interaction_type='reply' GROUP BY 1`).
4. Desligar IMAP: `ENABLE_IMAP_WARMUP=false` no Railway.
5. Após 7 dias estável, **remover o código IMAP** do repo.

---

## Gotchas conhecidos

1. **Gmail watch só notifica por LABEL** — se você marcar `labelIds: ["INBOX"]`, replies que caem em "Spam" não geram notificação. Pra warmup, considerar adicionar `["INBOX", "SPAM"]`.

2. **Pub/Sub deduplica em 10 minutos**, mas **não em janelas maiores**. Sempre idempotente no consumer.

3. **`ack-deadline=60s`**: se o backend não responder em 60s, Pub/Sub re-entrega. Por isso o handler **só enfileira** e responde 204 imediato. O trabalho real é no worker.

4. **OAuth refresh tokens podem ser revogados sem aviso** (mudança de senha do user, login de novo device, etc.). Backend precisa detectar 401 do Gmail API e marcar a credencial como `revoked` pra alertar o user.

5. **Quota de API Gmail**: 1 bilhão de quota units/dia por projeto. `users.history.list` custa 2 unidades. Mesmo com 100 caixas e 100 emails/dia/caixa, vc usa 20K unidades — trivial.

6. **Custo Pub/Sub**: $40 por TB de mensagens. Cada notificação é ~200 bytes. 1 bilhão de notificações = ~$8. Pra warmup (~1000 msgs/dia/caixa × 100 caixas = 100K/dia = 36M/ano), custo anual ~$0.30. **Pode esquecer do custo.**

---

## Checklist final antes de cutover

- [ ] GCP project criado com billing ativo
- [ ] Pub/Sub topic + subscription provisionados
- [ ] OAuth client_secret.json salvo em `gmail_oauth_credentials` para cada caixa
- [ ] Endpoint `/webhooks/gmail-pubsub` valida JWT do Google
- [ ] Worker `gmail.process-notification` implementado e testado em sandbox
- [ ] Cron `renewWatches` rodando diariamente
- [ ] Idempotency by `message_id` confirmada em testes
- [ ] Métricas Prometheus: `gmail_pubsub_received_total`, `gmail_watch_renewal_failures_total`
- [ ] Alert Sentry para 401 do Gmail API (credencial revogada)
- [ ] 3 dias rodando lado a lado com IMAP polling, números batem
- [ ] Desligar IMAP

---

## Referências
- https://developers.google.com/gmail/api/guides/push
- https://cloud.google.com/pubsub/docs/push
- https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions

*Documento criado em 2026-05-11 para uso futuro.*
