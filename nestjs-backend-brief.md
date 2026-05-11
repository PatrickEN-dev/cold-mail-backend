# Cold Email Pro — NestJS Backend Brief

> **Hand-off para um Claude que vai construir o backend do zero.**
> Fonte da verdade: estado vivo do Supabase + N8N, verificado via MCP em 2026-05-09.
> Tudo aqui é **fato** salvo onde explicitamente marcado como `INFERÊNCIA` ou `DECISÃO ABERTA`.

---

## 0. Como usar este documento

Você está assumindo um projeto que hoje roda em N8N + Next.js + Supabase. Sua missão é construir um **backend NestJS** que vai substituir o N8N gradualmente. Antes de codar **uma linha**:

1. Leia este doc inteiro (~45 min — §18 é grande mas é o que vai te poupar tempo na implementação).
2. Leia [CLAUDE.md](../CLAUDE.md) na raiz do repo (contexto geral).
3. Rode os comandos de **§5 Validation playbook** pra confirmar que o estado descrito ainda é o estado vivo.
4. Responda mentalmente as perguntas do **§14 Validation playbook** (gabarito incluído).
5. Volte pro user com as **16 decisões abertas em §13**. Não invente respostas.

**Não** crie nenhum arquivo, branch ou PR antes do passo 5.

### Como o doc está organizado

- **§1–§4** — contexto, constraints, stack, layout
- **§5** — comandos pra validar estado vivo antes de começar
- **§6** — as-is (DB + 13 workflows + integrações + routes Next)
- **§7** — target architecture (módulos, padrões, eventos)
- **§8** — plano de migração em 7 ondas
- **§9–§11** — specs por módulo, schema novo, env vars
- **§12** — anti-patterns
- **§13** — 17 decisões abertas (perguntar ao user)
- **§14** — perguntas de auto-validação com gabarito
- **§15–§16** — onboarding, comandos
- **§16.5** — bugs em prod descobertos na auditoria
- **§17** — checklist de paridade funcional por onda
- **§18** — apêndice verbatim (prompts, queries, payloads, código real dos workflows)

---

## 1. Missão

Construir um backend NestJS que, em **7 ondas**, retira workflows do N8N e os reimplementa como módulos do Nest, deixando o N8N apenas para integrações de terceiros que não justifiquem reescrever (ex: Unipile, na onda 7).

### Por que sair do N8N

Verificado nos dados:
- **Sem retry, sem DLQ, sem alerting.** 5 de 20 execuções recentes do `pt2` (envio real) erraram em silêncio. Ninguém viu.
- **Sem cron real.** Schedules `active` no DB com `last_run_at: null` e `next_run_at` em março/2026 — passaram, nunca dispararam. O "scheduler" hoje é o front fazendo POST.
- **Pipelines duplicados dentro de workflows** (warmup envio tem 2 pipelines, um disabled). Drift de produto.
- **Hardcoded.** Warmup roda em 3 contas Gmail (Abigail/Hanna/Emily) coladas no workflow, fora da plataforma `sender_emails`.
- **Reply ingestion não persiste corpo.** 10 leads `replied`, 0 com `response_content`. Tabela `email_messages` nem existe.
- **N8N workflows da org são compartilhados** com outros projetos do dono — instabilidade de uma muda afeta a outra.

### Sucesso = quando

- Onda atual em prod, com observabilidade (métricas + alertas), sem erros silenciosos.
- Front continua funcionando sem mudança visível pro usuário.
- N8N do escopo daquela onda **desligado** (não só "ignorado").
- **Paridade funcional verificada** contra checklist em §17. Não é "manda email" — é **manda email com display_name correto, template randomizado por anti-fingerprint, tipo de email escolhido, pacing entre envios, warmup respeitando budget, follow-up avançando client_step, etc.**

---

## 2. Hard constraints (não quebra)

| | |
|---|---|
| Front | Next.js 14 fica intacto, exceto por trocar URL do webhook (`NEXT_PUBLIC_WEBHOOK_N8N` → URL do Nest) e adicionar chamadas REST novas onde necessário. |
| Auth | Supabase Auth fica como fonte da verdade. Backend Nest **só verifica JWT**, não emite. |
| Single-tenant | Toda query filtra por `user_id`. RLS mantida como segunda camada. |
| RLS | Continua ligada. Se backend usar service-role, **sempre** filtra `user_id` manualmente. |
| Linguagem UI | Strings de UI em **inglês** (já é convenção do front). Logs/comentários em inglês. Conversa com o user em **pt-BR**. |
| Migrações DB | Toda DDL nova entra como arquivo `supabase/migrations/*.sql` no repo, antes de aplicar via `mcp__supabase__apply_migration`. Sem dashboard. |
| Segredos | `.env` é gitignored. Nunca logar `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `ZAPMAIL_API_KEY`, `UNIPILE_API_KEY`, `SMARTLEAD_API_KEY`, `UNIPILE_WEBHOOK_SECRET`. |

---

## 3. Stack travada

| Camada | Pacote | Versão pinada |
|---|---|---|
| Runtime | Node.js | `20.x` (LTS) |
| Framework | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify` | `^10.4` |
| Linguagem | `typescript` | `^5.6` |
| DB driver | `postgres` | `^3.4` |
| ORM | `drizzle-orm`, `drizzle-kit` | `^0.36`, `^0.28` |
| Auth verify | `@supabase/supabase-js` (só `auth.getUser`) | `^2.46` |
| Filas | `bullmq`, `@nestjs/bullmq`, `ioredis` | `^5.21`, `^10.2`, `^5.4` |
| Cron | `@nestjs/schedule` | `^4.1` |
| Validação | `zod`, `nestjs-zod` | `^3.23`, `^3.0` |
| HTTP out | `undici`, `cockatiel` | `^6.20`, `^3.2` |
| Email — Resend | `resend` | `^4.0` |
| Email — SES | `@aws-sdk/client-ses` | `^3.682` |
| Email — SMTP | `nodemailer` | `^6.9` |
| Email — Zapmail/Mailgun/SmartLead | `undici` direto na API REST | — |
| LinkedIn (Unipile) | `undici` direto | — |
| AI | `openai` | `^4.69` |
| Logging | `nestjs-pino`, `pino` | `^4.1`, `^9.5` |
| Errors | `@sentry/node` | `^8.36` |
| Testes | `vitest`, `@nestjs/testing`, `testcontainers`, `msw` | `^2.1`, `^10.4`, `^10.13`, `^2.6` |
| Hosting | Railway (Postgres Supabase + Redis Railway + container Nest) | — |

> Use as versões acima como mínimo. Lockfile (`pnpm-lock.yaml`) é a fonte exata da verdade depois do `pnpm install`.

### Por que cada escolha

- **Drizzle, não Prisma.** Schema typesafe sem decorators, queries SQL-first, melhor pra alguém que pensa em SQL. Prisma adiciona magia que não justifica aqui.
- **Fastify, não Express.** ~2x mais rápido, todo ecossistema Nest suporta.
- **BullMQ, não pgmq.** pgmq existe na imagem do Supabase mas não está habilitado, e BullMQ tem features (delayed jobs, repeatables, DLQ, dashboards) prontas.
- **OpenAI direto.** Paridade com warmup atual (LangChain+OpenAI no N8N). Prompts existentes migram sem rework. **Não usar LangChain** — é peso desnecessário.
- **Railway.** Postgres já no Supabase; Railway entra para Redis + container. Deploy git-push, custo ~$5–20/mês inicial.

---

## 4. Repo layout

```
/Users/tecnologia/projetos/coldmail-bg-ia-labtracker/
├── app/                       # Next.js App Router (front, NÃO MEXER)
│   ├── api/                   # Routes Next que ficam (auth-bound)
│   └── ...                    # páginas
├── components/, hooks/, lib/  # Front, NÃO MEXER
├── supabase/migrations/       # Migrations versionadas (truth para schema)
├── docs/                      # docs vivas
│   ├── CLAUDE.md (na raiz)    # contexto geral do produto
│   ├── n8n-workflows.md       # mapa dos workflows (DESATUALIZADO em pontos — ver §6.2)
│   ├── N8N_SENDER_EMAILS_INTEGRATION.md  # contrato webhook front→N8N (referência)
│   ├── warmup-budget-n8n.html # contrato edge function (referência)
│   ├── n8n-reply-ingestion.html  # spec NÃO IMPLEMENTADA de email_messages
│   └── nestjs-backend-brief.md   # ← este arquivo
└── .env                       # gitignored
```

**Onde vai o backend novo:** ver decisão #1 em §13. Default: monorepo `apps/api/` + `packages/shared/` com pnpm workspaces.

---

## 5. Validation playbook — RODE ANTES DE QUALQUER COISA

**Objetivo:** confirmar que o estado descrito aqui ainda é real. As coisas mudam. Rode em paralelo:

```typescript
// Via MCP Supabase
mcp__supabase__list_tables({ schemas: ["public"], verbose: true })
mcp__supabase__list_migrations()
mcp__supabase__list_edge_functions()
mcp__supabase__get_advisors({ type: "security" })
mcp__supabase__get_advisors({ type: "performance" })

// SQL probes — comparar com §6.1
mcp__supabase__execute_sql({ query: `
  SELECT 'tables' AS what, COUNT(*)::text AS v FROM information_schema.tables WHERE table_schema='public'
  UNION ALL SELECT 'has_email_messages', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_messages')::text
  UNION ALL SELECT 'emails_total', (SELECT COUNT(*) FROM emails)::text
  UNION ALL SELECT 'replied_with_body', (SELECT COUNT(*) FROM emails WHERE status='replied' AND COALESCE(response_content,'')<>'')::text
  UNION ALL SELECT 'sender_warmups_rows', (SELECT COUNT(*) FROM sender_warmups)::text
  UNION ALL SELECT 'warmup_interactions_replies', (SELECT COUNT(*) FROM email_warmup_interactions WHERE interaction_type='reply')::text
  UNION ALL SELECT 'schedules_with_lastrun', (SELECT COUNT(*) FROM schedules WHERE last_run_at IS NOT NULL)::text;
`})

// Via MCP N8N
mcp__n8n-mcp__n8n_health_check()
mcp__n8n-mcp__n8n_list_workflows({ active: true, limit: 100 })
mcp__n8n-mcp__n8n_get_workflow({ id: "jhzBrpA2g5mYOMon", mode: "structure" })
mcp__n8n-mcp__n8n_executions({ action: "list", workflowId: "jhzBrpA2g5mYOMon", status: "error", limit: 50 })
```

**Discrepâncias?** Pare e atualize este doc antes de seguir. Marque uma seção `### Drift detected on YYYY-MM-DD` no fim do arquivo.

---

## 6. As-is — o que existe HOJE

### 6.1 Banco (Supabase Postgres)

12 tabelas em `public`, **todas com RLS habilitada**.

| Tabela | Linhas* | Papel | Notas críticas |
|---|---:|---|---|
| `emails` | 2248 | Leads/contatos (entidade central) | 40 colunas. `response_content`, `reply_we_got`, `reply_time` **0% populados** apesar de 10 leads `status='replied'`. |
| `settings` | 5 | webhook_url + email_template + linkedin_webhook_url por user | |
| `linkedin_accounts` | 2 | Contas Unipile conectadas | |
| `linkedin_messages` | 2 | Mensagens LinkedIn + perfil | 8 índices unused (advisor) |
| `schedules` | 2 | Disparos agendados | **Ambos `active` com `last_run_at: NULL` e `next_run_at` em março/2026 já vencido.** Confirma: não há scheduler server-side. |
| `sender_emails` | 21 | Caixas de envio | 12 resend / 3 zapmail / 3 smtp(smartlead) / 3 google. CHECK em `platform`. |
| `subscriptions` | 5 | Plano por user | |
| `profiles` | 5 | Dados extras do user | |
| `email_templates` | 1 | Templates por plataforma | quase vazia, feature subutilizada |
| `email_warmup_interactions` | 726 | Log de envios warmup | **100% `interaction_type='sent'`, 0 `reply`.** Auto-reply nunca grava. Schema sem `user_id` — RLS via JOIN. |
| `sender_warmups` | **0** | Config de warmup por sender | **Vazia em prod.** Toda infra do front+budget+UI nunca foi configurada por ninguém. |
| `reply_actions` | 0 | Override manual de intent + arquivar | Infra pronta, sem uso. |

\* Snapshot 2026-05-09. Re-rode validation playbook.

**Tabela que NÃO existe ainda mas deveria:** `email_messages` — para chat thread (spec em [n8n-reply-ingestion.html](n8n-reply-ingestion.html)). **Onda 2 cria.**

#### 6.1.1 Schema drift quantificado

Migrations no Supabase: 20. No repo (`supabase/migrations/`): 13. **7 migrations em prod sem arquivo correspondente:**

```
20251215222742  simplify_schema_for_mvp
20260413124110  create_profiles_table
20260414014320  add_platform_to_sender_emails
20260414034838  deduplicate_emails_and_add_unique_constraint
20260414040815  add_dispatch_tracking_to_emails
20260414043228  add_daily_limit_to_sender_emails
20260502034339  inbox_pipeline_fixes_2026_05_01
```

**Ação na onda 0:** rodar `drizzle-kit pull` (ou `drizzle-kit introspect`) contra o Postgres vivo, gerar `schema.ts` Drizzle como espelho do estado real. Migrations futuras saem do Drizzle. Os 7 arquivos faltantes não precisam ser "reconciliados" — o Drizzle vira a nova fonte da verdade.

#### 6.1.2 RPCs públicas (chamadas pelo front via `supabase.rpc()`)

```
calculate_lead_quality_score(...)  -- INVOKER
pipeline_metrics(...)              -- INVOKER, agregação para dashboard
sender_email_stats(...)            -- INVOKER, agregação
user_campaign_names(...)           -- INVOKER
```

Front chama via `supabase.rpc('pipeline_metrics', {...})`. **Manter** essas funções no DB durante toda a migração (front não muda). NestJS pode também chamá-las via Drizzle (`sql.raw`) ou reimplementar em código — ver §10 onda 6.

#### 6.1.3 Triggers

Notáveis:

- `auth.users → handle_new_user()` (DEFINER) — cria `profiles` quando usuário se registra.
- `auth.users → handle_new_user_subscription()` (DEFINER) — cria `subscriptions`.
- **Duplicação confirmada**: `emails` tem 2 triggers idênticos (`emails_update_updated_at` E `update_emails_updated_at`), ambos disparando `update_updated_at_column()`. Mesmo em `settings`. Limpar na onda 0 (DROP do duplicado).
- `linkedin_messages_update_lead_score` em INSERT e UPDATE.

#### 6.1.4 Edge function — `warmup-budget`

**Status:** ACTIVE, `verify_jwt: true`, único edge function deployado.

**URL:** `https://kxgwviiewmnmignqmptu.supabase.co/functions/v1/warmup-budget?sender_email_id=<uuid>`

**Auth:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (não anon — `verify_jwt: true` exige JWT válido).

**Source completo (versão 1):**

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

function isBusinessDay(d: Date): boolean {
  const dow = d.getDay()
  return dow !== 0 && dow !== 6
}

function businessDaysBetweenInclusive(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0,0,0,0)
  const b = new Date(to); b.setHours(0,0,0,0)
  if (a > b) return 0
  let count = 0
  const d = new Date(a)
  while (d <= b) { if (isBusinessDay(d)) count++; d.setDate(d.getDate() + 1) }
  return count
}

Deno.serve(async (req) => {
  const senderEmailId = new URL(req.url).searchParams.get('sender_email_id')
  if (!senderEmailId) return json({ error: 'sender_email_id is required' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: sender } = await supabase.from('sender_emails')
    .select('id,user_id,email_address,daily_limit')
    .eq('id', senderEmailId).maybeSingle()
  if (!sender) return json({ error: 'sender_email not found' }, 404)

  const { data: warmup } = await supabase.from('sender_warmups').select('*')
    .eq('sender_email_id', senderEmailId).eq('user_id', sender.user_id).maybeSingle()

  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0)
  const { count: alreadySent } = await supabase.from('email_warmup_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('sender', sender.email_address.toLowerCase())
    .eq('interaction_type', 'sent')
    .gte('created_at', startOfToday.toISOString())

  if (!warmup) return json({ enabled: false, status: 'no_warmup_configured', /* ... */ remaining: 0 })
  if (!warmup.enabled) return json({ enabled: false, status: warmup.auto_paused_at ? 'auto_paused' : 'paused', /* ... */ remaining: 0 })

  const isRestDay = warmup.business_days_only && !isBusinessDay(new Date())
  let currentDay = 0
  if (warmup.started_at) {
    const startedAt = new Date(warmup.started_at)
    currentDay = warmup.business_days_only
      ? businessDaysBetweenInclusive(startedAt, new Date())
      : Math.floor((Date.now() - startedAt.getTime()) / 86_400_000) + 1
  }
  const raw = warmup.start_volume + (Math.max(1,currentDay)-1) * warmup.increment_per_day
  const allowedToday = isRestDay || currentDay === 0 ? 0 : Math.min(raw, warmup.daily_limit)
  return json({ enabled: true, status: isRestDay ? 'rest_day' : 'active', allowed_today: allowedToday, already_sent: alreadySent ?? 0, remaining: Math.max(0, allowedToday - (alreadySent ?? 0)) /* + outros */ })
})
```

**Pegadinha:** se `sender_warmups.started_at` for `NULL`, `currentDay = 0` → `allowedToday = 0` → warmup **nunca dispara**. UI precisa setar `started_at` ao habilitar. Verificar no código do front (ou backend) na **Onda 3** (warmup).

**Decisão:** edge function pode **continuar deployada** durante a migração — Nest consome o mesmo endpoint. Pós-Onda 3:

- **Quem chama:** o worker `warmup.tick` do Nest, antes de cada envio. Auth via `SUPABASE_SERVICE_ROLE_KEY` no header `Authorization: Bearer <...>` (mesma key que o Nest já usa pra DB).
- **Por que não inline em Nest:** mantém isolamento. Edge function é leitura simples (2 queries Postgres + computação determinística). Reimplementar em Nest dobra responsabilidade sem ganho.
- **Quando reimplementar em Nest:** se precisar de batch endpoint (consulta N senders de uma vez) ou se Supabase descontinuar Edge Functions. Não é prioridade.

### 6.2 N8N — 13 workflows do CEP

Instância: `https://n8n.coisasdecapitu.com.br`. Acesso via `mcp__n8n-mcp__*` (já configurado em `.mcp.json` gitignored).

**A doc [n8n-workflows.md](n8n-workflows.md) tem informação correta na maior parte mas está DESATUALIZADA em vários pontos** (workflow sizes, bugs, pipelines duplicados). Confiar na tabela abaixo, não na md original.

| ID | Nome | Nodes (real) | Papel | Status / Bugs |
|---|---|---:|---|---|
| `GIFZ8zzIWiXGdral` | `[email] pt 1 Split emails` | 19 | Entry webhook do front → split + route + Wait → chama pt2 | OK. `Wait` node é o "scheduler" de delay. |
| `jhzBrpA2g5mYOMon` | `[email] Send Email pt2` | **50** (doc dizia 49) | Envio real (Resend + Zapmail) | **Saga SmartLead (1→7) ÓRFÃ** dentro do pt2 — não conecta ao trigger (só era pra criar campanhas no SmartLead, não está wired). **Switch1 branch 1 vazia** (smartlead unwired no pt2). Mas o SmartLead **opera fora do pt2** — envia direto e nos manda eventos via `8CamkGMPY06aiLQ7`. **5/20 execuções recentes erraram** (1 batch só, não estatístico). |
| `NkZO6yq9LeKVBnbs` | `[Email] Webhook eventos` | 14 | Ingestão de eventos (Resposta/Bounced/Aberto/Entregue) | Funciona, mas ramo `Reposta` não persiste body. **Bug crítico.** |
| `GaDxY8f5dQnP0LG4` | `Aquecimento de emails(envio)` | **35** (doc dizia 14) | Warmup send + AI agent | **Pipeline duplicado**: `Schedule Trigger` original DESABILITADO; só `Schedule Trigger1` ativo. **3 Gmails hardcoded** (Abigail/Hanna/Emily) — fora de `sender_emails`. **Não consulta `warmup-budget`.** |
| `bTuTALx2EDDqBrxK` | `Aquecimento email(recebimento)` | **30** (doc dizia 14) | Auto-reply warmup | Webhook node DESCONECTADO. Triggers reais são 3 `gmailTrigger` hardcoded (Abigail/Emily/Hannah1). Nunca grava em `email_warmup_interactions` (0 replies). |
| `0x9tjMCXLxba1LqZ` | `[emails] Follow ups` | 20 | Follow-ups agendados | Cron `0 12 * * 1-4` (seg-qui 12h). Avança `client_step`. **Bug B5: só `dispatch_platform='resend'`** filtrado. Ver §18.6 (inline acima). |
| `G1G1DkHf7GrU79us` | `[Tigger] - zera limite` | 4 | Cron, zera contadores | Confirmado: UPDATE `sender_emails.today_usage=0`. **Bug B11**: também zera `max_interactions=0` em `email_warmup_interactions`, quebra warmup recv. Ver §18.7. |
| `estBS0PmeL1hFpDe` | `[Linkedin] envio` | 17 | LinkedIn send via Unipile | Profile lookup → If `is_relationship` → DM ou invite. **Bug B3**: anti-spam `If1` com conditions vazias. Ver §18.5. |
| `8FaGelWVDKyoAS7r` | `[linkedin] Recebe eventos` | 11 | LinkedIn events webhook | **Bugs B13** (attendee_id hardcoded), **B16** (update por chat_id sobrescreve), **B17** (sem threading). Ver §18.9. |
| `nNEGPw9Eb4suATn3` | `[email] Pesquisa V1` | 42 | Endpoint `/search` (enrichment) | Pipeline: RapidAPI maps-data + local-business-data + AI scorer + verify-email. **Bug B2 crítico**: `user_id` hardcoded. Ver §18.6. |
| `8CamkGMPY06aiLQ7` | `[SmartLead] Atualiza-base` | 7 | Webhook eventos SmartLead | **FUNCIONA** (pinData 2026-04-15). 4 UPDATEs em `emails`. SmartLead opera externamente. **Bug B12**: abusa `our_last_reply` pra HTML enviado. Ver §18.8. |
| `UBXSpTG6kyijdzaw` | `[descarteLinkedin]...` | 4 | Cria auth link Unipile | **Bug B15**: URLs com placeholders literais (`{SEU_DSN}`, `seu-n8n.com`). OAuth provavelmente quebrado. Substituto correto em [app/api/unipile-auth/](../app/api/unipile-auth/route.ts). Ver §18.10. |
| `6hgCvqOmiAoFjQG7` | `[descarte]Uniple-conexão` | 3 | Callback Unipile (INSERT linkedin_accounts) | **Bug B14 crítico**: aceita callback sem HMAC. Substituto correto em [app/api/unipile-callback/](../app/api/unipile-callback/route.ts). Ver §18.10. |

Outros 8 workflows ativos no N8N **não são do CEP** (Telegram webhook, Agente IA Jessica, testes datacrazy, etc — outros projetos do dono). Ignorar.

#### 6.2.1 Contrato do webhook front → pt1 (`NEXT_PUBLIC_WEBHOOK_N8N`)

Em [lib/scheduleWebhook.ts](../lib/scheduleWebhook.ts):

```json
{
  "dispatches": [
    {
      "sender_email": {
        "id": "uuid",
        "email_address": "...",
        "display_name": "...",
        "domain": "...",
        "provider": "resend|zapmail|...",
        "provider_id": "...",
        "platform": "none|smartlead|resend|zapmail|google|outlook"
      },
      "platform": "...",
      "emails": [ /* lead objects */ ]
    }
  ],
  "total_leads": 42,
  "schedule": true,
  "date": "ISO timestamp",
  "schedule_id": "uuid",
  "schedule_name": "...",
  "schedule_type": "one_time|recurring",
  "scheduled_date": "YYYY-MM-DD|null",
  "scheduled_time": "HH:MM",
  "recurring_days": ["mon","tue",...],
  "sender_email": { /* duplicado, legacy */ },
  "platform": "...",
  "emails": [ /* duplicado, legacy */ ]
}
```

**Backend Nest precisa aceitar esse formato exato na onda 5** (cutover do dispatch).

### 6.2.2 Capacidades funcionais não-óbvias

Os workflows N8N fazem muito mais do que "manda email". Antes de implementar qualquer onda, **leia §18 (apêndice verbatim)** que tem o conteúdo real (prompts OpenAI, queries SQL, código JS, payloads HTTP, conditions de Switch/If) extraído via MCP. Mapa rápido:

| Workflow | Capacidades não-óbvias | Onde está documentado |
|---|---|---|
| Pt2 (dispatch) | Resolve `display_name` via Postgres, randomiza template anti-fingerprint, escolhe tipo de email, pacing 90-150s, quota 15/dia | §18.1 |
| Eventos | Lookup `from_address` com regex `<(.+?)>`, sub-flow `delivered` incrementa `today_usage` | §18.2 |
| Warmup envio | SQL `provider IN ('resend','google')` define rede; randomizer faz pares sender→receiver; AI prompt corporate em pt-BR; thread_id determinístico | §18.3 |
| Warmup recv | 3 GmailTriggers polling 1min; `In-Reply-To`+`References` headers preservados; `max_interactions` 1-3 random pra parar cadeia | §18.4 |
| LinkedIn send | Profile lookup Unipile antes; decisão DM vs invite por `is_relationship`; mensagem hardcoded GBC Cleaning | §18.5 |
| Search | RapidAPI maps-data + local-business-data + verify-email-pro; 2 AI Agents; user_id hardcoded (BUG B2) | §18.6 |
| zera limite | UPDATE today_usage=0 (correto) + UPDATE max_interactions=0 (BUG B11) | §18.7 |
| SmartLead Atualiza-base | 4 ramos por event_type; abusa `our_last_reply` pra HTML enviado (BUG B12) | §18.8 |
| LinkedIn events | attendee_id hardcoded (BUG B13); update por chat_id sobrescreve histórico (BUG B16) | §18.9 |

### 6.3 Integrações externas

| | Como hoje | O que faz |
|---|---|---|
| **Resend** | HTTP API (key em N8N credentials) | Envio email (12 senders configurados) |
| **Zapmail** | HTTP API + sync via [app/api/zapmail/sync/](../app/api/zapmail/sync/route.ts) | Envio + sincroniza mailboxes |
| **SmartLead** | HTTP API (Saga 7 passos no pt2 — **órfã**) | Envio gerenciado externamente |
| **AWS SES** | **0 senders cadastrados** (sender_emails não tem provider='ses'). Strategy implementar mas pode ficar dormante. | Provider opcional |
| **Mailgun** | **0 senders cadastrados**. Mesma situação. | Provider opcional |
| **Google/Outlook** | 3 senders Google (provider='google'), 0 Outlook. Hoje envio via N8N Gmail node. | Envio direto |
| **Unipile (LinkedIn)** | OAuth via [app/api/unipile-auth/](../app/api/unipile-auth/route.ts), callback em [app/api/unipile-callback/](../app/api/unipile-callback/route.ts) (HMAC com `timingSafeEqual`) | Conta + send + receive LinkedIn |
| **OpenAI** | LangChain agent dentro dos workflows de warmup + search | Geração de email natural + auto-reply + normalização de dados |
| **Stripe ou similar (billing)** | Tabela `subscriptions` tem `external_customer_id` + `external_subscription_id` populados | 🔴 UNKNOWN qual provider — perguntar user |

### 6.4 Routes Next.js — quem fica, quem migra

O front Next.js tem rotas em [app/api/](../app/api/) que **não passam por N8N** mas também são "backend logic". Decidir destino de cada uma:

| Route | O que faz | Default sugerido |
|---|---|---|
| [app/api/schedules/trigger/](../app/api/schedules/trigger/route.ts) | Front chama isso pra disparar schedule manual (com SSRF guard) | **Migra para Nest** na Onda 5 (`POST /schedules/:id/trigger`) |
| [app/api/unipile-callback/](../app/api/unipile-callback/route.ts) | Webhook Unipile (callback OAuth + eventos). HMAC `timingSafeEqual` | **Migra para Nest** na Onda 7 (`POST /webhooks/unipile`) |
| [app/api/unipile-auth/](../app/api/unipile-auth/route.ts) | Cria auth link Unipile pro front mostrar | 🔴 **DECISÃO ABERTA #11** — front pode chamar Nest, mas é uma chamada simples; pode ficar no Next |
| [app/api/zapmail/sync/](../app/api/zapmail/sync/route.ts) | Sync mailboxes Zapmail → `sender_emails` (manual, via UI) | 🔴 **DECISÃO ABERTA #12** — provavelmente migra para Nest na Onda 6 (com cron periódico, deixa de ser manual) |
| [app/api/linkedin-accounts/](../app/api/linkedin-accounts/) | GET/DELETE contas LinkedIn (CRUD direto Postgres com auth) | **Fica no Next** — é CRUD simples com RLS, não tem lógica que justifique mover |

**Regra geral:** se a route só faz `auth.getUser()` + Supabase query + retorna JSON, **fica no Next**. Se faz fetch para terceiro, lógica de negócio, ou seria beneficiada por job assíncrono, **migra para Nest**.

---

## 7. Target architecture

### 7.1 Diagrama

```
            ┌─────────────────────────┐
            │  Next.js (front)        │  ← intacto
            │  - Auth Supabase JWT    │
            └────────────┬────────────┘
                         │ HTTPS + Bearer JWT
                         ▼
        ┌──────────────────────────────────────┐
        │   NestJS API (Fastify)               │
        │                                      │
        │  Controllers (REST + webhooks)       │
        │       │                              │
        │  Application (Use Cases / Commands)  │
        │       │                              │
        │  Domain (Aggregates + Events)        │
        │       │                              │
        │  Ports → Adapters                    │
        │     ├ EmailProvider (6 strategies)   │
        │     ├ LinkedInProvider (Unipile)     │
        │     └ AIProvider (OpenAI)            │
        │                                      │
        │  Workers (BullMQ) ─ paralelos        │
        └─────┬───────────────┬────────────────┘
              │               │
              ▼               ▼
        ┌─────────┐    ┌─────────────┐
        │ Postgres│    │   Redis     │
        │(Supabase│    │  (BullMQ)   │
        │ direto) │    └─────────────┘
        └─────────┘
              ▲
              │ Edge function (warmup-budget) — mantida
              │ Auth/Storage (Supabase) — mantido
```

### 7.2 Bounded contexts (módulos Nest)

```
src/
├── modules/
│   ├── auth/             # Verifica JWT Supabase, injeta user no request
│   ├── leads/            # CRUD de emails(leads), campaigns
│   ├── senders/          # CRUD sender_emails, daily quota
│   ├── templates/        # CRUD email_templates + resolver default
│   ├── schedules/        # CRUD schedules + producer BullMQ
│   ├── dispatch/         # Núcleo do envio
│   │   ├── application/  # Use cases (SendBatch, SendOne)
│   │   ├── workers/      # BullMQ processors
│   │   └── domain/       # Dispatch aggregate, value objects
│   ├── providers/
│   │   ├── email/        # Strategy: Resend, Zapmail, SES, Mailgun, SMTP, Google, Outlook
│   │   └── linkedin/     # Unipile adapter
│   ├── webhooks/         # Inbound: provider events, unipile, zapmail
│   ├── inbox/            # email_messages aggregate (chat thread)
│   ├── warmup/           # Budget + send engine + auto-reply
│   ├── follow-ups/       # Cron-based follow-up engine
│   ├── ai/               # OpenAI port + adapter
│   └── analytics/        # RPCs / aggregates
├── infra/
│   ├── database/         # Drizzle schema + client
│   ├── queue/            # BullMQ config + tokens
│   ├── cache/            # Redis client
│   └── observability/    # pino, sentry
├── shared/
│   ├── domain/           # Base Entity, ValueObject, DomainEvent
│   ├── events/           # Event catalog
│   └── errors/
└── main.ts
```

### 7.3 Padrões aplicados

| Padrão | Onde | Por quê |
|---|---|---|
| **Strategy** | `EmailProviderStrategy` (1 classe por provider) | Substitui Switch hardcoded do N8N |
| **Adapter** | Unipile, Zapmail-sync, OpenAI | Isola APIs externas atrás de interfaces |
| **Repository** | 1 por aggregate | Domínio agnóstico de Drizzle |
| **Saga / Process Manager** | (Reservado — provavelmente não usar) | Padrão pra orquestrar fluxos multi-passo com compensações. Saga SmartLead do pt2 está órfã e não migra. |
| **Outbox** | `dispatch_outbox` table → worker | At-least-once entre front→worker |
| **Idempotency Key** | Webhooks (provider_message_id) | Provider retry não duplica |
| **Circuit Breaker** | Adapters externos (cockatiel) | Resend/Unipile cair não trava tudo |
| **Domain Events** | `EmailSent`, `ReplyReceived`, etc | Inbox/analytics/auto-pause reagem desacoplados |

**Não usar:** event sourcing puro, microservices, gRPC interno, GraphQL (REST é suficiente).

### 7.4 Catálogo de domain events

Lista única, autoritativa. Use exatamente esses nomes nas implementações.

| Evento | Emitido por | Consumido por | Payload (mínimo) |
|---|---|---|---|
| `EmailSent` | `dispatch` worker | `inbox`, `analytics` | `{ emailId, userId, senderEmailId, providerMessageId, sentAt }` |
| `EmailSendFailed` | `dispatch` worker | `analytics`, Sentry | `{ emailId, userId, error: { code, message }, attemptedAt }` |
| `ReplyReceived` | `webhooks/email-events` | `inbox`, `analytics`, eventual notifier | `{ emailId, userId, fromAddress, body, providerMessageId, receivedAt }` |
| `BounceReceived` | `webhooks/email-events` | `senders` (auto-pause), `analytics` | `{ emailId, userId, senderEmailId, bounceType, receivedAt }` |
| `EmailOpened` | `webhooks/email-events` | `analytics` | `{ emailId, userId, openedAt }` |
| `WarmupSent` | `warmup` worker | `analytics` | `{ senderEmailId, userId, threadId, sentAt }` |
| `WarmupAutoPaused` | `warmup.bounce-check` job | `senders`, notifier | `{ senderEmailId, userId, reason, bounceRatePct }` |
| `ScheduleFired` | `schedules` cron | `dispatch` (producer) | `{ scheduleId, userId, leadIds, senderEmailId }` |
| `LinkedInMessageReceived` | `webhooks/unipile` | `analytics`, eventual notifier | `{ messageId, userId, accountId, fromIdentifier, body, receivedAt }` |

Implementação: `EventEmitter2` do Nest (`@nestjs/event-emitter`). Subir pra mensageria externa (NATS/Kafka) só quando virar gargalo.

---

## 8. Migration plan — 7 ondas

Estratégia: **strangler fig**. Nest sobe lado a lado do N8N. Cada onda:
1. Implementa o módulo no Nest
2. Roteia tráfego (URL ou config)
3. Valida em paralelo com N8N por ≥3 dias
4. Desliga workflow N8N
5. Atualiza [n8n-workflows.md](n8n-workflows.md) marcando `MIGRATED`

### Onda 0 — Fundação (1 semana)

**Escopo:**
- Scaffolding Nest + Fastify + módulos base
- Drizzle `pull` do Postgres → `schema.ts` (resolve drift)
- Auth guard verificando JWT Supabase ponta-a-ponta
- BullMQ + Redis na Railway
- Pino logs estruturados + Sentry
- 1 endpoint dummy autenticado pra validar pipeline
- CI básico: typecheck + vitest + drizzle-kit check
- Deploy Railway com health check

**Limpezas DDL na mesma onda:**
- DROP do trigger duplicado em `emails` (mantém só `update_emails_updated_at`)
- DROP do trigger duplicado em `settings`
- DROP dos 18 unused indexes (ver advisor) — economiza WAL e custo de UPDATE

**AC:**
- `curl https://api-cep.up.railway.app/health` retorna 200
- `curl -H "Authorization: Bearer <JWT>" .../auth/me` retorna user_id correto
- Sentry captura erro de teste

### Onda 1 — Investigação + cron utilitário

**Pré-requisito (decisão #2):** investigar os 5/20 errors do `pt2` antes de codar a onda. Comando:

```typescript
mcp__n8n-mcp__n8n_executions({ action: "get", id: "58516", mode: "error" })
```

Se for sistêmico, corrigir antes. Se pontual, seguir.

**Escopo:**
- Migrar `[Tigger] - zera limite` (`G1G1DkHf7GrU79us`) → `@Cron('0 0 * * *')` no Nest
- UPDATE diário em `sender_emails.today_usage = 0`
- **Não migrar** o segundo UPDATE (`max_interactions=0`) — é bug B11
- Onda mais simples — valida pipeline ponta-a-ponta

**AC:** Job rodou 3 noites seguidas, `today_usage` zerado em todos os senders no horário. Workflow N8N desligado.

### Onda 2 — Webhook ingestion + email_messages

**Escopo:**
- Migration: criar `email_messages` (spec em [n8n-reply-ingestion.html](n8n-reply-ingestion.html))
- Endpoint `POST /webhooks/email-events` no Nest com HMAC verification
- Substitui `NkZO6yq9LeKVBnbs`
- Para evento `Resposta`:
  - Resolve `email_id` por `from_address` (lookup em `emails`, ordem por `date_sent DESC`, `LIMIT 1`)
  - Resolve `user_id` via `emails.user_id` (a tabela `email_messages` exige user_id)
  - INSERT em `email_messages` (direction='inbound')
  - UPDATE `emails` (status='replied', reply_time=now)
- Para `Bounced`/`Aberto`/`Entregue`: UPDATE em `emails` (mesmo comportamento atual)
- Idempotency: dedupe por `(provider_message_id, direction)` — unique index garante
- Observability: contador Prometheus por evento + provider

**Backfill:** **provavelmente impossível.** Nenhum provider mantém histórico de reply bodies acessível por API após X dias. Os 10 leads `replied` ficam sem corpo persistido — `email_messages` será populada apenas com replies novos. **Confirmar com user antes de tentar backfill.**

#### 2.1 Payload por provider — contratos reais

Os 3 providers que mandam eventos hoje têm shapes diferentes. Implementar `WebhookPayloadParser` por provider.

**Resend** (`https://resend.com/docs/dashboard/webhooks/event-types`):
```json
{
  "type": "email.delivered" | "email.bounced" | "email.opened" | "email.complained",
  "created_at": "2026-05-09T12:00:00Z",
  "data": {
    "email_id": "uuid-do-resend",
    "from": "sender@dominio.com",
    "to": ["lead@empresa.com"],
    "subject": "..."
  }
}
```
> Resend **não envia eventos de reply** — replies vêm via inbound parsing separado, configurado no domínio. Verificar setup com user.

**SmartLead** (`https://api.smartlead.ai/api/v1/campaigns/webhooks` — formato observado em prod):
```json
{
  "event": "EMAIL_SENT" | "EMAIL_REPLY" | "EMAIL_BOUNCED" | "EMAIL_OPEN",
  "campaign_id": 123,
  "lead": {
    "email": "lead@empresa.com",
    "id": 456
  },
  "reply": {                     // somente em EMAIL_REPLY
    "from_email": "lead@empresa.com",
    "from_name": "Jane",
    "to_email": "sender@dominio.com",
    "subject": "Re: ...",
    "message_body": "...",
    "message_id": "<...@mail.gmail.com>",
    "in_reply_to": "<...@resend.dev>"
  },
  "bounce": { "type": "hard|soft", "reason": "..." }    // somente em EMAIL_BOUNCED
}
```

**Zapmail** — confirmar shape com user (não tive acesso a sample em prod). Provavelmente similar ao SmartLead.

**Common normalized event** (após parser):
```typescript
type NormalizedEmailEvent = {
  provider: 'resend' | 'smartlead' | 'zapmail'
  type: 'sent' | 'delivered' | 'bounced' | 'opened' | 'replied'
  externalMessageId: string
  occurredAt: Date
  to: string
  from: string
  reply?: {
    fromName?: string
    subject?: string
    bodyText?: string
    bodyHtml?: string
    inReplyTo?: string
  }
  bounce?: { type: 'hard' | 'soft'; reason?: string }
}
```

**Trocar URL no painel** SmartLead/Resend para o Nest. N8N continua rodando em paralelo por 3 dias (escrevendo no mesmo DB) — verificar se números batem.

**AC:**
- Novo reply chega → `email_messages` populada com body
- Front renderiza chat thread (`useReplyMessages` hook a criar)
- Métrica `webhook_events_total{event="reply"}` crescente

### Onda 3 — Warmup completo (REIMPLEMENTAÇÃO, não migração)

Esta onda é a mais cara. O warmup atual no N8N **não é o que está documentado**:
- Usa 3 Gmails hardcoded (não `sender_emails`)
- Pipeline duplicado dentro do mesmo workflow
- Nunca consultou `warmup-budget`
- Auto-reply nunca persistiu nada

**Escopo:**
- Cron 3x/dia (manhã/tarde/noite) com BullMQ repeatable
- Para cada `sender_warmups.enabled = true`:
  - Chama edge function `warmup-budget` (mantida, ver §6.1.4)
  - Se `remaining > 0`:
    - Gera conteúdo via OpenAI (port `AIProvider`)
    - Manda via `EmailProviderStrategy` apropriado pro `sender_emails`
    - Insere `email_warmup_interactions` (interaction_type='sent')
- Webhook `POST /webhooks/warmup-reply` recebe respostas:
  - Insere `email_warmup_interactions` (interaction_type='reply')
  - Gera resposta via OpenAI
  - Manda via mesma rota
- Auto-pause: BullMQ scheduled job verifica bounce rate > threshold
- UI: confirmar que ao habilitar `sender_warmups`, `started_at` é setado

> **Personas Gmail:** ver decisões #3, #10 e #16 em §13. Tem 3 contas (Abigail/Hanna/Emily em `gbestcleaning.info`) hardcoded no warmup envio + recv, e 9 contas (Sofia/Alesandra/etc em `gbccleaning.com/.space/.online`) hardcoded no pt2. Antes da onda 3, decidir se viram `sender_emails` ou continuam fora, e como detectar inbound (Pub/Sub vs IMAP).

**AC:**
- `sender_warmups` com >=1 row, rodando 3x/dia, gerando entries em `email_warmup_interactions`
- `auto_paused_at` populado quando bounce rate excede
- Workflows `GaDxY8f5dQnP0LG4` + `bTuTALx2EDDqBrxK` desligados

### Onda 4 — Dispatch (o coração)

**Escopo:**
- Endpoint `POST /dispatch` aceitando o payload exato de §6.2.1
- Use case `SendBatchUseCase`:
  - Valida sender existe + ativo + tem quota
  - Resolve template via `TemplatesModule`
  - Para cada lead: enfileira `dispatch.send` job no BullMQ
- Worker `dispatch.send`:
  - Aplica delay se `schedule.scheduled_date` no futuro (BullMQ delayed job)
  - Chama `EmailProviderStrategy` apropriado (Resend/Zapmail/SES/Mailgun/SMTP/Google/Outlook)
  - UPDATE `emails` (status, sender_email_id, dispatch_platform, date_sent)
  - INSERT `email_messages` (direction='outbound')
  - Emite domain event `EmailSent`
- Retry com backoff exponencial; 3 falhas → DLQ + Sentry
- **Dashboard básico de jobs** (Bull Board)

**SmartLead:** ver decisão #4 em §13. Plataforma envia direto e webhooka eventos pra Onda 2. **A Saga órfã do pt2 NÃO migra** (era criar campanhas no SmartLead via API, abandonada). `platform='smartlead'` em `sender_emails` continua valida pra leads que vieram de lá, mas o Nest não dispara via SmartLead — Resend e Zapmail apenas.

**Cutover:** trocar `NEXT_PUBLIC_WEBHOOK_N8N` no `.env` da Vercel → URL do Nest. Manter feature flag `DISPATCH_VIA_N8N=false` durante 7 dias para rollback rápido.

**AC:**
- Front dispara batch → emails saem → status atualiza
- Dispatch agendado para futuro: BullMQ segura, dispara no horário
- Erro num lead não derruba o batch
- Métricas: `dispatch_total{provider="...",status="..."}`

### Onda 5 — Schedules como cidadão de primeira classe

**Hoje:** Front chama webhook ao criar/editar schedule, e o `Wait` do N8N segura. **Schedules ativos com `last_run_at: null` = bug.**

**Escopo:**
- Cron `@Cron('* * * * *')` no Nest, evalua `schedules WHERE status='active' AND next_run_at <= now()`
- Para cada: enfileira no BullMQ `dispatch.send`, atualiza `last_run_at`, recomputa `next_run_at` (recurring) ou marca `completed` (one_time)
- Endpoint `POST /schedules/:id/trigger` (manual) — substitui [app/api/schedules/trigger/](../app/api/schedules/trigger/route.ts)
- Backfill: rodar uma vez nos 2 schedules atuais com `next_run_at` no passado — decidir se executa ou marca `completed`

#### 5.1 ⚠️ Timezone — gotcha crítico

O front computa `nextRunAt` em **timezone LOCAL do browser** (ver [lib/scheduleLogic.ts](../lib/scheduleLogic.ts) — `parseScheduleDateLocal`, `setHours(...)` sem `Z`). Hoje funciona porque o usuário e o servidor N8N estão na mesma timezone (Brasil).

**Quando o Nest rodar em UTC (Railway default), schedules vão disparar em horário errado** (3h atrasado). Soluções:
- (a) **Front passa offset:** payload inclui `tz: 'America/Sao_Paulo'`, Nest computa em UTC. Recomendado.
- (b) Container Nest com `TZ=America/Sao_Paulo`. Funciona mas é frágil (multi-tenant futuro quebra).
- (c) Reescrever `scheduleLogic.ts` no front para sempre serializar em UTC. Quebra schedules existentes.

`DECISÃO ABERTA #9` — escolher (a) ou (b). Default: (a).

Adicionar em `schedules` table: coluna `tz text NOT NULL DEFAULT 'America/Sao_Paulo'`. Migration na onda 5.

**AC:**
- Criar schedule recurring → roda no horário automaticamente, sem N8N
- `last_run_at` populado após cada run
- Front mostra "última execução" com timestamp real

### Onda 6 — Follow-ups + Search

**Escopo:**
- Migrar `0x9tjMCXLxba1LqZ` (follow-ups) → BullMQ repeatable + use case
- Migrar `nNEGPw9Eb4suATn3` (`/search` endpoint) → controller Nest
- Limpar nodes desconectados (`cria_contato`, `envia email transacional`) — não migrar
- Analytics RPCs (`pipeline_metrics`, etc): manter no DB, mas Nest também as chama via Drizzle `sql`. Front continua usando direto via `supabase.rpc()`.

### Onda 7 — LinkedIn (Unipile) + cleanup final

**Escopo:**
- Migrar `estBS0PmeL1hFpDe` (send) + `8FaGelWVDKyoAS7r` (events) para módulo `providers/linkedin` no Nest
- Investigar `[descarte]` workflows (`UBXSpTG6kyijdzaw`, `6hgCvqOmiAoFjQG7`) — ver quem chama via logs Unipile
  - Se Unipile callback antigo: atualizar URL no Unipile e desligar
  - Se nada chama: desligar
- Desligar workflow `[SmartLead] Atualiza-base` (já está broken, ninguém vai notar)
- Decidir destino dos 8 workflows N8N que não eram do CEP — provavelmente ficam (são de outros projetos)

**AC final:** zero workflows N8N do CEP ativos. `docs/n8n-workflows.md` atualizado para um arquivo histórico.

---

## 9. Per-module specs (resumido)

> Detalhe completo só ao chegar na onda do módulo. Aqui um esqueleto.

### 9.1 `modules/dispatch`

**Aggregate:** `Dispatch` (id, userId, senderEmailId, platform, leads[], scheduledFor, status, createdAt)

**Use cases:**
- `SendBatchUseCase` — recebe payload do front, valida, persiste, enfileira
- `SendOneUseCase` — chamado pelo worker, executa 1 envio

**Workers (BullMQ):**
- `dispatch.send` — processa 1 lead, retry 3x com backoff exponencial
- `dispatch.batch-finalize` — quando todos os jobs do batch terminam, agrega resultado

**Eventos emitidos:**
- `EmailSent { emailId, providerId, sentAt }` → consumido por `inbox` + `analytics`
- `EmailSendFailed { emailId, error }` → consumido por `analytics` + `Sentry`

**Endpoints:**
- `POST /dispatch` — aceita payload §6.2.1
- `GET /dispatch/:batchId` — status do batch

### 9.2 `modules/providers/email`

**Port:** `IEmailProvider`
```typescript
interface IEmailProvider {
  readonly name: ProviderName  // 'resend' | 'zapmail' | ...
  send(args: SendEmailArgs): Promise<SendEmailResult>
  verifyDomain?(domain: string): Promise<DomainStatus>
}
```

**Strategies (1 classe cada):**
- `ResendEmailProvider`
- `ZapmailEmailProvider`
- `SESEmailProvider`
- `MailgunEmailProvider`
- `SMTPEmailProvider`
- `GoogleEmailProvider` (Gmail API ou OAuth)
- `OutlookEmailProvider` (Graph API)
- ~~`SmartLeadEmailProvider`~~ — não implementar. SmartLead envia direto (decisão #4). Implementar apenas o webhook parser em §18.8.

**Registry:** `EmailProviderRegistry` injeta o strategy correto baseado em `sender_emails.provider`.

**Resilience:** cada strategy envolvida com `cockatiel` (timeout 15s, retry 2x, circuit breaker 50% errors / 30s).

### 9.3 `modules/webhooks`

**Endpoints:**
- `POST /webhooks/email-events` — provider events (reply/bounce/open/delivered) — substitui `NkZO6yq9LeKVBnbs`
- `POST /webhooks/warmup-reply` — auto-reply do warmup network
- `POST /webhooks/unipile` — eventos Unipile (substitui [app/api/unipile-callback/](../app/api/unipile-callback/route.ts))

**Cada webhook:**
- Verifica HMAC signature com `crypto.timingSafeEqual`
- Valida payload com Zod
- Idempotency: query por `provider_message_id`, skip se já existe
- Persiste + emite domain event
- Responde 200 rápido, processa em worker

### 9.4 `modules/inbox`

Cria/lê `email_messages`. Endpoints:
- `GET /emails/:id/messages` — thread completa
- (escuta) `EmailSent` → INSERT outbound
- (escuta) `ReplyReceived` → INSERT inbound

### 9.5 `modules/warmup`

- Cron `@Cron(CronExpression.EVERY_DAY_AT_8AM/2PM/8PM)` (3 batches)
- Job `warmup.tick`: lista `sender_warmups WHERE enabled=true`, chama `warmup-budget`, se `remaining>0` → enfileira `warmup.send`
- Job `warmup.send`: gera conteúdo (OpenAI), envia (EmailProvider), grava `email_warmup_interactions`
- Job `warmup.bounce-check`: 1x/dia, calcula bounce rate por sender, auto-pausa se excede

---

## 10. Schema novo a adicionar (NÃO existe hoje)

### 10.1 `email_messages`

```sql
CREATE TABLE email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

  thread_id text,
  provider_message_id text,
  in_reply_to text,

  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),

  from_address text NOT NULL,
  from_name text,
  to_address text NOT NULL,
  subject text,
  body_text text,
  body_html text,

  provider text,
  sent_at timestamptz NOT NULL,
  received_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX email_messages_email_id_created_at_idx ON email_messages (email_id, created_at);
CREATE UNIQUE INDEX email_messages_dedupe ON email_messages (provider_message_id, direction)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant isolation" ON email_messages
  USING ((SELECT auth.uid()) = user_id);
```

### 10.2 `dispatch_outbox` (opcional)

Possível tabela auxiliar para garantir at-least-once entre front e worker (front insere atômico, worker consome). Ver decisão #7 em §13. Default: postergar até ter problema real de jobs perdidos.

---

## 11. Variáveis de ambiente (Nest)

```
# Database
DATABASE_URL=postgresql://...                  # Postgres do Supabase, conexão direta (não pgbouncer pra DDL)
DATABASE_POOL_URL=postgresql://...             # pgbouncer pra runtime

# Supabase (auth)
SUPABASE_URL=https://kxgwviiewmnmignqmptu.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...                  # cuidado: bypass RLS

# Redis (BullMQ)
REDIS_URL=redis://...

# Webhooks inbound
WEBHOOK_HMAC_SECRET=...                        # nosso, para SmartLead/Resend assinarem
UNIPILE_WEBHOOK_SECRET=...                     # já existe em prod
ZAPMAIL_WEBHOOK_SECRET=...

# Email providers
RESEND_API_KEY=...
ZAPMAIL_API_KEY=...
SES_AWS_ACCESS_KEY_ID=...
SES_AWS_SECRET_ACCESS_KEY=...
SES_REGION=us-east-1
MAILGUN_API_KEY=...
SMARTLEAD_API_KEY=...                          # se mantermos
SMTP_HOST=...                                  # default fallback

# AI
OPENAI_API_KEY=...

# LinkedIn (Unipile)
UNIPILE_API_KEY=...
UNIPILE_DSN=...                                # ex: api26.unipile.com:15613

# Search (RapidAPI — usado em /search)
RAPIDAPI_KEY=...                               # geocoding + local-business + verify-email-pro

# Observability
SENTRY_DSN=...
LOG_LEVEL=info

# Frontend coords
FRONTEND_URL=https://coldmail-bg-ia-labtracker.vercel.app   # CORS
```

> **NOTA:** os 7 segredos atuais nos workflows N8N (Resend, Zapmail, SmartLead, Unipile, RapidAPI×1 (compartilhada com 3 endpoints), Brevo, SmartLead secret_key) estão **vazados em texto plano**. Ver §16.5 B1 + §18.11. **Antes da Onda 0**, o owner precisa rotacionar todas e mover para credentials seguras.

---

## 12. Anti-patterns / scope traps

**Não faça:**
- Microservices day-1. É monolito modular.
- Reescrever o front. Front é intacto.
- Mudar Supabase Auth (verificar JWT é diferente de "trocar auth").
- Implementar GraphQL ou tRPC. REST + Zod é suficiente.
- Usar Prisma ou TypeORM. Decisão é Drizzle.
- Implementar event sourcing. Domain events sim, sourcing não.
- Adicionar Kafka/NATS. EventEmitter interno do Nest é suficiente até ter motivo real.
- Migrar tudo num PR. Strangler fig em 7 ondas.
- "Reconciliar" os 7 migrations órfãos manualmente. Drizzle pull resolve.
- Implementar `SmartLeadEmailProvider` para enviar via API SmartLead. SmartLead opera externamente — só fazer parser de webhook (§18.8).
- Tocar nos 8 workflows N8N que **não são** do CEP.

**Cuidado com:**
- RLS bypass: se usar service role, **sempre** filtre `user_id`. RLS não te protege.
- Idempotency em webhooks: provider retry é a regra, não exceção.
- `started_at` em `sender_warmups`: precisa ser populado pra rampa contar.
- Strings UI em pt-BR: convenção é **inglês**. Pt-BR é só pra chat com user.
- Wait em workflow N8N legacy: alguns disparos têm delay de **dias**. Cuidar do cutover (Onda 4) pra não perder jobs em flight.

---

## 13. Decisões abertas (perguntar antes de codar)

| # | Pergunta | Default sugerido |
|---|---|---|
| 1 | Monorepo (`apps/api/`) ou repo separado? | Monorepo |
| 2 | Investigar erros do `pt2` antes da Onda 1? | **Sim, obrigatório** |
| 3 | 3 Gmails do warmup (Abigail/Hanna/Emily) viram `sender_emails` ou ficam fora? | Viram `sender_emails` |
| 4 | SmartLead: cortar do escopo (Saga órfã no pt2) ou manter como **provider externo** que envia direto e webhooka eventos pra nós? | **Manter como provider externo.** SmartLead está vivo (auditoria viu eventos chegando 2026-04-15). Cortamos só a Saga órfã do pt2. Webhook ingestion (`8CamkGMPY06aiLQ7`) precisa migrar pra Onda 2. |
| 5 | Edge function `warmup-budget`: manter (recomendo) ou portar pra Nest? | Manter |
| 6 | `[descarte]` workflows: investigar quem chama, ou desligar direto e ver o que quebra? | Investigar |
| 7 | `dispatch_outbox` table: implementar na onda 4 ou postergar? | Postergar até ter problema |
| 8 | LangChain (atual) ou OpenAI puro? | OpenAI puro |
| 9 | Timezone schedules: front passa `tz` (a) ou container TZ=BR (b)? | (a) Front passa tz |
| 10 | Como Nest detecta inbound em Gmail (warmup recv)? Pub/Sub (a), IMAP polling (b), ou N8N continua só nesse trigger (c)? | (b) IMAP polling pra MVP, (a) quando escalar |
| 11 | `app/api/unipile-auth/` migra pra Nest ou fica no Next? | Fica no Next (chamada simples) |
| 12 | `app/api/zapmail/sync/` migra pra Nest com cron periódico? | Sim, na Onda 6 |
| 13 | Billing: qual é o provider externo (`subscriptions.external_*_id`)? Stripe? Migra pra Nest ou continua isolado? | Perguntar — provavelmente fora de escopo da migração N8N |
| 14 | Pacing/delay entre sends: BullMQ `rateLimit` na queue (global) ou `delay` por job (configurável por sender)? | `rateLimit` por sender (job priority + queue limits) |
| 15 | "Tipos de email" (cold/followup/etc) e "templates randomizados": migrar lógica do pt2 ou repensar? | Migrar fielmente na Onda 4, refatorar depois |
| 16 | Warmup network: cada user tem rede isolada (multi-tenant) ou rede global compartilhada? | Perguntar — afeta arquitetura do warmup |

---

## 14. Validation playbook (verifique que entendeu)

Antes de codar, responda mentalmente (ou em voz alta com user). **Não pule** — gabarito abaixo, confirme contra ele.

1. Quantas tabelas tem o Postgres hoje, e qual delas vai ser **criada** pela onda 2?
2. Por que `sender_warmups` tem 0 linhas mas o N8N de warmup roda há semanas?
3. Por que vou rodar `drizzle-kit pull` em vez de aplicar os 7 migrations órfãos no repo?
4. Qual workflow N8N tem o bug que justifica investigar **antes** de qualquer migração?
5. Qual o fluxo: front cria schedule → ??? → email sai. Como funciona hoje, e como vai funcionar na onda 5?
6. O que acontece se eu trocar `NEXT_PUBLIC_WEBHOOK_N8N` pro Nest na onda 4 e o Nest cair?
7. Por que webhooks externos precisam de idempotency e como implemento?
8. Em qual onda devo me preocupar com timezone, e por quê?

### Gabarito

1. **12 tabelas em `public`** (`emails`, `settings`, `linkedin_accounts`, `linkedin_messages`, `schedules`, `sender_emails`, `subscriptions`, `profiles`, `email_templates`, `email_warmup_interactions`, `sender_warmups`, `reply_actions`). A criar na Onda 2: **`email_messages`**.
2. Porque o N8N de warmup **não usa** a infra `sender_warmups` da plataforma — ele tem 3 contas Gmail hardcoded (Abigail/Hanna/Emily) dentro do workflow. Toda a UI de warmup do front vai num registro vazio. A "onda warmup" é REIMPLEMENTAÇÃO, não migração — ver §8 Onda 3.
3. Os 7 órfãos foram aplicados via dashboard sem versionamento; reescrever cada um seria arqueologia. `drizzle-kit pull` introspece o estado real do Postgres e gera `schema.ts` típico — Drizzle vira a nova fonte da verdade. Migrations futuras saem do Drizzle.
4. **`jhzBrpA2g5mYOMon`** (`[email] Send Email pt2`). Em uma batch recente, 5 de 20 execuções erraram em silêncio. Não é prova de 25% sistemático mas justifica `mcp__n8n-mcp__n8n_executions action=get mode=error` antes de migrar.
5. **Hoje:** front computa `nextRunAt` localmente e POSTa pro N8N → workflow `pt1` faz `Wait` segurando o disparo → roda. Schedules persistidos no DB **não têm cron server-side puxando** (provado: 2 schedules com `last_run_at: null` e `next_run_at` em março já vencidos). **Onda 5:** Nest cron roda a cada minuto, evalua `schedules WHERE next_run_at <= now() AND status='active'`, enfileira no BullMQ, atualiza `last_run_at`, recomputa `next_run_at`.
6. Disparos novos ficam órfãos (front recebe 502/timeout). Para mitigar: feature flag `DISPATCH_VIA_N8N=true` por 7 dias após cutover, podendo voltar via env. Considerar `dispatch_outbox` (DECISÃO ABERTA #7) se quiser at-least-once garantido.
7. Provider faz retry quando não recebe 200 rápido. Sem idempotency, mesmo evento gera 2+ linhas em `email_messages` ou 2+ updates em `emails`. Implementação: unique index em `(provider_message_id, direction)` em `email_messages`; query antes de INSERT por `provider_message_id`.
8. **Onda 5 (schedules).** Front computa hora em timezone local; Nest em Railway roda UTC por default. Ver §8 Onda 5.1 — gotcha crítico que quebra todos schedules silenciosamente se ignorado.

Se errar qualquer uma, releia o doc inteiro antes de continuar.

---

## 15. Onboarding — primeira sessão

Sequência recomendada para a primeira hora:

1. `cd /Users/tecnologia/projetos/coldmail-bg-ia-labtracker`
2. Lê: este doc + [CLAUDE.md](../CLAUDE.md)
3. Roda **§5 Validation playbook** completo, anota discrepâncias
4. Lê com atenção: [lib/scheduleWebhook.ts](../lib/scheduleWebhook.ts), [lib/scheduleLogic.ts](../lib/scheduleLogic.ts), [lib/autoRouting.ts](../lib/autoRouting.ts), [app/api/schedules/trigger/route.ts](../app/api/schedules/trigger/route.ts), [app/api/unipile-callback/route.ts](../app/api/unipile-callback/route.ts)
5. Investiga 1 erro do `pt2` (`mcp__n8n-mcp__n8n_executions action=get id=58516 mode=error`) e reporta o stack trace
6. Volta pro user com:
   - Confirmação de que o estado descrito ainda é o estado vivo (ou drift detectado)
   - Stack trace do erro do `pt2` + hipótese de causa
   - Respostas das 16 decisões abertas (§13)
7. **Só então** começa o scaffolding (Onda 0)

---

## 16. Apêndice: comandos de uso comum

```bash
# Front
npm run dev                              # :3000
npm run typecheck                        # tsc --noEmit
npm run lint

# Backend (após criar apps/api)
cd apps/api
pnpm dev                                 # :4000
pnpm test
pnpm test:e2e
pnpm drizzle:pull                        # introspect from prod (cuidado!)
pnpm drizzle:generate                    # gera migration a partir do schema
pnpm drizzle:push                        # aplica em dev
```

```typescript
// MCP — investigação
mcp__supabase__execute_sql({ query: "..." })
mcp__supabase__list_tables({ schemas: ["public"], verbose: true })
mcp__supabase__get_advisors({ type: "security" })
mcp__n8n-mcp__n8n_executions({ action: "get", id: "<exec_id>", mode: "error" })
mcp__n8n-mcp__n8n_get_workflow({ id: "<workflow_id>", mode: "structure" })
```

---

## 16.5 Bugs em produção descobertos na auditoria

> Esta seção lista bugs **reais em produção** encontrados ao auditar workflows N8N + Postgres ao vivo via MCP. **Endereçar antes ou durante as ondas correspondentes** — receiver Claude não deve "migrar" um bug.

| # | Bug | Onde | Severidade | Onda |
|---|---|---|---|---|
| B1 | **6 API keys hardcoded em sticky notes / HTTP headers** dos workflows N8N (Resend, Zapmail, SmartLead, Unipile, RapidAPI, Brevo). + 1 secret_key SmartLead que aparece em payload pinned. Ver §18.11. | Vários workflows | 🔴 Crítico (segurança) | **Antes da Onda 0** — rotacionar |
| B2 | **`/search` insere todos os leads com `user_id` hardcoded** `"0e632f97-5c20-4d53-a22e-b5935185c810"` (single tenant break). Explica concentração de 2248 leads em poucos users. | `nNEGPw9Eb4suATn3` node `Edit Fields` | 🔴 Crítico (multi-tenant) | Onda 6 |
| B3 | **`If1` do LinkedIn tem condições vazias** — anti-spam check em `linkedin_messages` foi configurado mas não decide nada. Mesmo lead pode receber 2+ DMs. | `estBS0PmeL1hFpDe` | 🟡 Funcional | Onda 7 |
| B4 | **`Reposta_staus` foi modificado pra remover persistência do reply body** (versão atual SÓ updates `status='replied'`). A versão anterior salvava `reply_we_got`. Alguém desativou. | `NkZO6yq9LeKVBnbs` | 🟡 Funcional | Onda 2 (reescreve) |
| B5 | **Follow-up só roda pra `dispatch_platform = 'resend'`** — Zapmail/Google/SmartLead leads ficam sem follow-up automático. | `0x9tjMCXLxba1LqZ` query `get_emails` | 🟡 Funcional | Onda 6 |
| B6 | **2 redes warmup distintas no mesmo projeto** — pt2 (dispatch) usa 9 personas em `gbccleaning.com` / `gbcleaning.space` / `gbcleaning.online`; warmup envio usa 3 personas em `gbestcleaning.info`. Confusão de domínios, possível drift. | pt2 + warmup | 🟡 Confusão | Onda 3/4 |
| B7 | **Saga SmartLead órfã + branch unwired** confirma SmartLead morto. | pt2 | 🟢 Limpeza | Onda 4 (cortar) |
| B8 | **2 nodes Brevo órfãos** em `Pesquisa V1` (`cria_contato`, `envia email transacional`) — feature de email transacional planejada e abandonada. | `nNEGPw9Eb4suATn3` | 🟢 Limpeza | Onda 6 (não migrar) |
| B9 | **Pt2 tem dois pipelines paralelos** (Resend e Zapmail) com lógica idêntica duplicada — manutenção dupla. | pt2 | 🟢 Refactor | Onda 4 (unificar via Strategy) |
| B10 | **Warmup envio tem dois pipelines duplicados** dentro do mesmo workflow (um disabled). | warmup | 🟢 Limpeza | Onda 3 |
| B11 | **`zera limite` zera `max_interactions=0`** em `email_warmup_interactions` (além de `today_usage` em `sender_emails`). Isso provavelmente **quebra warmup recv** — a condição de parada é `interaction_order != max_interactions`, que é verdadeira eternamente quando `max_interactions=0`. | `G1G1DkHf7GrU79us` | 🟡 Funcional | Onda 1 (não migrar esse update — é bug) |
| B12 | **`SmartLead Atualiza-base` reaproveita `our_last_reply`** pra guardar HTML do email **enviado** (não o reply). Nome misleading. Frontend que ler essa coluna pensa que é resposta. | `8CamkGMPY06aiLQ7` | 🟡 Schema confuso | Onda 2 — usar `email_messages` (direction='outbound') em vez de poluir `our_last_reply` |
| B13 | **`[linkedin] Recebe eventos` filtra por `attendee_id` hardcoded** (`GZO2tjQaWvKb3Y17_z8AnQ`) — esse é o ID de UMA conta Unipile específica. Multi-tenant break similar ao `/search` (B2). Outros users perdem eventos LinkedIn. | `8FaGelWVDKyoAS7r` | 🔴 Multi-tenant | Onda 7 |
| B14 | **`[descarte]Uniple-conexão` aceita callback Unipile SEM auth** (sem HMAC). Qualquer um que conheça `/webhook/linkedin-conectado` pode INSERT lixo em `linkedin_accounts`. O fix já está em [app/api/unipile-callback/](../app/api/unipile-callback/route.ts) com `timingSafeEqual`, mas o N8N velho **continua ativo aceitando**. Desligar o N8N. | `6hgCvqOmiAoFjQG7` | 🔴 Segurança | **Antes da Onda 0** ou Onda 7 (desligar workflow) |
| B15 | **`[descarteLinkedin]` usa templates de URL com placeholders nunca substituídos** (`https://{SEU_DSN}`, `https://seu-n8n.com/webhook/...`, `https://seusite.com/sucesso`). Se Unipile tentar usar o `notify_url` ou `redirect_url`, vai pra placeholder literal. **Provavelmente quebra fluxo OAuth** se for chamado. | `UBXSpTG6kyijdzaw` | 🟡 Funcional | Onda 7 (desligar — Next já tem versão correta) |
| B16 | **LinkedIn events update por `chat_id`** (não `message_id`) → 2ª mensagem no mesmo chat **sobrescreve** a primeira em `linkedin_messages.response_content`. Histórico perdido. | `8FaGelWVDKyoAS7r` (Update a row1) | 🔴 Funcional | Onda 7 — usar `email_messages` analog para `linkedin_messages` (1 row por message, não por chat) |
| B17 | **Tabela `linkedin_messages` reaproveitada como inbox** mas só guarda 1 reply (`response_content` é `text`, não `text[]`). Threading impossível. | schema | 🟡 Schema | Onda 7 — criar `linkedin_messages_thread` análoga a `email_messages` |

---

## 17. Checklist de paridade funcional — verificar antes de desligar cada workflow

Antes de marcar uma onda como "completa" e desligar workflow N8N, **rode este checklist** contra a feature implementada no Nest. Não é opcional.

### Onda 2 — Eventos
- [ ] Webhook recebe payload Resend e atualiza `emails.status='delivered'` corretamente
- [ ] Webhook recebe payload Resend `bounced` e atualiza `emails.status='bounced'`
- [ ] Webhook recebe payload Resend `opened` e atualiza `emails.status='opened'`
- [ ] Webhook recebe payload SmartLead `EMAIL_REPLY` e cria linha em `email_messages` com body
- [ ] Webhook recebe payload SmartLead `EMAIL_REPLY` e atualiza `emails.status='replied'` + `reply_time=now`
- [ ] Idempotency: mesmo evento enviado 2x não duplica linha em `email_messages`
- [ ] Sub-flow equivalente a `email_foi_entregue` (Get a row antes de Update) está implementado se necessário

### Onda 3 — Warmup
- [ ] `sender_warmups` configurado com `started_at` populado quando habilitado
- [ ] Worker chama edge function `warmup-budget` antes de cada envio
- [ ] Respeita `remaining` retornado (`is_rest_day`, `auto_paused`, etc.)
- [ ] Conteúdo gerado por OpenAI é natural (paridade com prompt do `AI Agent` do N8N)
- [ ] Envia via `EmailProviderStrategy` correto (não Gmail node)
- [ ] Pacing entre envios — não dispara 50 emails em 1 segundo
- [ ] `email_warmup_interactions` populada com `interaction_type='sent'`
- [ ] Inbound chega → `email_warmup_interactions` populada com `interaction_type='reply'` (hoje 0!)
- [ ] Auto-reply chega via inbound trigger (decisão #10)
- [ ] Auto-pause quando bounce rate excede

### Onda 4 — Dispatch
- [ ] Recebe payload §6.2.1 do front sem mudança no front
- [ ] **Resolve `display_name` do sender** antes de enviar (paridade `SENDER_NAME` node)
- [ ] **Randomiza template** entre N variantes pra evitar fingerprint (paridade `randomiza email`)
- [ ] **Escolhe tipo de email** (cold/followup/etc) (paridade `Randomiza tipo de email`)
- [ ] **Aplica pacing** entre envios do mesmo batch (paridade `Wait` nodes)
- [ ] Roteia por `sender_emails.platform` para o `EmailProviderStrategy` correto
- [ ] Erro num lead não derruba o batch (retry isolado)
- [ ] Atualiza `emails.status` + `sender_email_id` + `dispatch_platform` + `date_sent`
- [ ] Insere `email_messages` com `direction='outbound'`

### Onda 5 — Schedules
- [ ] Cron evalua `next_run_at <= now()` e dispara
- [ ] Recurring recomputa `next_run_at`; one_time marca `completed`
- [ ] Timezone respeitado (decisão #9)
- [ ] `last_run_at` populado após cada execução (hoje NULL em todos!)

### Onda 6 — Follow-ups + Search
- [ ] Follow-up dispara após X dias sem reply (X = ler do workflow original)
- [ ] Avança `client_step` corretamente
- [ ] Templates de follow-up são os mesmos do `mensagens_email` node
- [ ] Search faz geocoding + Maps + AI normalize + email verify (paridade workflow `Pesquisa V1`)
- [ ] Zapmail sync via cron mantém `sender_emails` em dia

### Onda 7 — LinkedIn
- [ ] Send: busca perfil → decide message vs invite baseado em `is_connected`
- [ ] Anti-spam: não manda mensagem se já mandou (paridade `Get a row` + `If1`)
- [ ] Eventos LinkedIn (received, status updates) chegam e atualizam `linkedin_messages`
- [ ] `[descarte]` workflows desligados após investigação

---

## 18. Apêndice — conteúdo extraído dos workflows N8N (verbatim)

> Esta seção é a **fonte da verdade** dos prompts, queries SQL, JS code, payloads de HTTP, templates e conditions usados em prod hoje. Receiver Claude porta isso fielmente nas ondas correspondentes.

### 18.1 pt2 — `[email] Send Email pt2` (jhzBrpA2g5mYOMon)

#### Switch1 — roteamento por plataforma

```
$json.plataform === "resend"   → output 0
$json.plataform === "smartlead" → output 1
$json.plataform === "zapmail"  → output 2
```

#### Switch2 — roteamento por tipo de email (Zapmail flow)

```
$json.emailType === "1" → output 0
$json.emailType === "2" → output 1
$json.emailType === "3" → output 2
```

#### `randomiza email` (Code node) — resolve display_name por sender

```javascript
const senders = [
  { name: "Sofia Martins",       email: "sofia.martins@gbccleaning.com" },
  { name: "Alesandra Rodrigues", email: "alesandra.rodrigues@gbccleaning.com" },
  { name: "Emma Johnson",        email: "emma.johnson@gbccleaning.com" },
  { name: "Olivia Smith",        email: "olivia.smith@gbcleaning.space" },
  { name: "Ava Wilson",          email: "ava.wilson@gbcleaning.space" },
  { name: "Mia Anderson",        email: "mia.anderson@gbcleaning.space" },
  { name: "Isabella Thomas",     email: "isabella.thomas@gbcleaning.online" },
  { name: "Charlotte Jackson",   email: "charlotte.jackson@gbcleaning.online" },
  { name: "Amelia White",        email: "amelia.white@gbcleaning.online" }
];
const senderEmail = $input.first().json.sender_email;
const foundSender = senders.find(s => s.email === senderEmail);
return [{ json: {
  sender_email: senderEmail,
  sender_name: foundSender ? foundSender.name : null,
  found: !!foundSender
}}];
```

> **Para o Nest:** essa lógica deve sair do código. Substituir por query no `sender_emails` (campo `display_name`). Os 9 contatos hardcoded são parte da rede GBC Cleaning — ver §18.7.

#### `Randomiza tipo de email` (Code) — escolhe entre 3 templates

```javascript
const TOTAL_TIPOS = 3;
const emailType = Math.floor(Math.random() * TOTAL_TIPOS) + 1;
return { emailType: Number(emailType) };
```

#### `SENDER_NAME` / `SENDER_NAME1` (Postgres) — query de lookup

```sql
SELECT * FROM sender_emails WHERE email_address = '{{ $json.sender_email }}';
```

> ⚠️ **SQL injection visível** — query usa interpolação de string n8n direto. No Nest, usar parameterized query (Drizzle: `eq(senderEmails.emailAddress, ...)`).

#### Templates de email — Resend flow (3 variantes)

**Edit Fields → Template 1: "Cleaning services"**
```
Subject: Cleaning services
HTML:
<strong>Hey,</strong>
<p>I wanted to check if you'd be open to receiving a cleaning quote.</p>
<p>For new commercial clients, we usually start with an initial service so you can see how our team works before deciding on anything.</p>
<p>Best,<br>{{ sender_name }}<br>GBC Cleaning</p>
```

**Edit Fields1 → Template 2: "Building cleaning question"**
```
Subject: Building cleaning question
HTML:
<strong>Hey,</strong>
<p>I wanted to see if receiving a cleaning quote would be useful for you.</p>
<p>When working with new commercial clients, we usually begin with an initial service so you can understand how our team operates before moving forward.</p>
<p>Best,<br>{{ sender_name }}<br>GBC Cleaning</p>
```

**Edit Fields2 → Template 3: "Would a cleaning quote be useful"**
```
Subject: Would a cleaning quote be useful
HTML:
<strong>Hey,</strong>
<p>I wanted to check whether a cleaning quote would make sense for you.</p>
<p>With new commercial clients, we generally start with an initial service so you can get a feel for how our team works before making a decision.</p>
<p>Best,<br>{{ sender_name }}<br>GBC Cleaning</p>
```

> **Nota crítica para o backend novo:** esses templates estão **hardcoded** no workflow N8N. Não há `email_templates` configurados em prod (`SELECT COUNT(*) FROM email_templates` = 1 vazio). A migração precisa decidir: portar templates para a tabela `email_templates` (recomendado) ou manter hardcoded em código.

#### Resend HTTP — `HTTP Request1`

```
POST https://api.resend.com/emails
Headers:
  Authorization: Bearer <REDACTED-RESEND-KEY>
Body (JSON):
{
  "from": "{{ SENDER_NAME1.display_name }} <{{ SENDER_NAME1.email_address }}>",
  "to": ["{{ Start.email }}"],
  "subject": "{{ subject }}",
  "html": "{{ html }}",
  "reply_to": "{{ SENDER_NAME1.email_address }}"
}
```

#### Zapmail HTTP — `Zapmail - Enviar Email`

```
POST https://api.zapmail.ai/api/v2/onebox/send-email
Headers:
  x-auth-zapmail: <REDACTED-ZAPMAIL-KEY>
  Content-Type: application/json
Body (JSON):
{
  "from": "{{ SENDER_NAME.display_name }}",
  "account": "{{ SENDER_NAME.email_address }}",
  "to": "{{ Start.email }}",
  "subject": "{{ subject }}",
  "body": "{{ html }}"
}
```

#### Wait durations (pacing entre envios)

| Node | Expressão | Faixa |
|---|---|---|
| `Wait` | `Math.floor(Math.random() * 31) + 90` | 90–120s |
| `Wait1` | `Math.floor(Math.random() * 10) + 140` | 140–149s |
| `Wait2` | `Math.floor(Math.random() * 10) + 140` | 140–149s |

> **Para BullMQ:** usar `rateLimit` ou `delay` por job, não `setTimeout`. Recomendação: queue dedicada por sender com `rateLimiter: { max: 1, duration: 120_000 }` (1 envio/120s).

#### If / If1 — quota check

```
$('SENDER_NAME').item.json.today_usage > 15
```

> Se today_usage > 15, **pula o envio**. Sender com 15+ envios no dia não dispara mais. Migrar para `senders.daily_limit` configurável por sender.

#### Saga SmartLead (órfã, mas documentada)

Sequência de 7 HTTP requests:
1. `POST https://server.smartlead.ai/api/v1/campaigns/create?api_key=...` → cria campanha
2. `POST .../campaigns/{id}/schedule?api_key=...` com `timezone: America/Sao_Paulo`, `days_of_the_week: [3]` (quarta), `start_hour: 12:00`, `end_hour: 13:00`, `min_time_btw_emails: 6`, `max_new_leads_per_day: 90`
3. Set: salva `campaign_id`
4. `POST .../campaigns/{campaign_id}/email-accounts?api_key=...` com `email_account_ids: [17784331, 17784328, 17784327]` (IDs SmartLead hardcoded)
5. `POST .../campaigns/{campaign_id}/sequences?api_key=...` com 1 sequence: subject "Cleaning services"
6. `POST .../campaigns/{campaign_id}/leads?api_key=...`
7. `POST .../campaigns/{campaign_id}/status?api_key=...` com `{ "status": "START" }`

> **Decisão #4:** cortar SmartLead. Se mantiver, virar `SmartLeadCampaignSaga` (state machine com compensações).

---

### 18.2 Eventos — `[Email]Webhook eventos` (NkZO6yq9LeKVBnbs)

#### Webhook

```
POST /webhook/received
```

#### Switch — 4 ramos por `body.type`

| Type | Ramo |
|---|---|
| `email.received` | "Reposta" — atualiza status `replied` |
| `email.bounced` | "Bounced" — atualiza status `bounced` |
| `email.opened` | "Aberto" — atualiza status `opened` |
| `email.delivered` | "Email entregue" — incrementa `today_usage` do sender |

#### Reposta_staus (Supabase update)

```
UPDATE emails SET status = 'replied' WHERE email = body.data.from
```

> ⚠️ **BUG B4:** versão atual NÃO popula `reply_we_got`. Versão anterior tinha `reply_we_got = "Subject: {body.data.subject}\nReply: "` mas mesmo lá o body real do reply não vinha. **Ondas 2 do brief precisa criar `email_messages` table e gravar body real do reply** — isso significa que o webhook payload do provider precisa incluir o body, **o que Resend NÃO envia em `email.received`**. Verificar onde o body chega — pode ser via Svix inbound parsing configurado no domínio, não no event webhook.

#### email_foi_entregue → Get a row → Update a row

```sql
SELECT * FROM sender_emails 
  WHERE email_address = body.data.from.match(/<(.+?)>/)?.[1] || body.data.from;

UPDATE sender_emails 
  SET today_usage = today_usage + 1
  WHERE email_address = body.data.from.match(/<(.+?)>/)?.[1] || body.data.from;
```

> Daqui sai a regra do `today_usage`: incrementado a cada `email.delivered`. Combina com o reset de `[Tigger] - zera limite`.

---

### 18.3 Warmup envio — `Aquecimento de emails(envio)` (GaDxY8f5dQnP0LG4)

#### Schedule Triggers

- `Schedule Trigger` (DESABILITADO): a cada 6 horas em :10
- `Schedule Trigger1` (ATIVO): mesmo cron — única instância rodando

#### SQL — quem participa do warmup network

```sql
SELECT * from sender_emails where provider in ('resend', 'google');
```

> ⚠️ **Crítico:** TODOS os senders Resend e Google viram parte da rede de warmup automaticamente. Não há flag `participate_in_warmup` em `sender_emails`. Onda 3 deve adicionar essa flag (ou usar `sender_warmups.enabled` que já existe mas é vazio).

#### `randomizador1` (Code) — embaralha e faz pares sender→receiver

```javascript
const accounts = $input.all().map(item => item.json);
const active = accounts.filter(a => a.status === 'active' && a.email_address);
if (active.length < 2) throw new Error('Precisa de pelo menos 2 contas ativas');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const shuffled = shuffle(active);
const out = [];
for (let i = 0; i < shuffled.length; i++) {
  const sender = shuffled[i];
  let receiver = shuffled[(i + 1) % shuffled.length];
  if (sender.email_address === receiver.email_address) {
    receiver = shuffled[(i + 2) % shuffled.length];
  }
  out.push({ json: {
    execution: i + 1,
    sender_name: sender.display_name,
    sender_email: sender.email_address,
    sender_id: sender.id,
    sender_platform: sender.platform || sender.provider,
    receiver_name: receiver.display_name,
    receiver_email: receiver.email_address,
    receiver_id: receiver.id,
    receiver_platform: receiver.platform || receiver.provider,
    daily_limit: sender.daily_limit ?? 30,
    today_usage: sender.today_usage ?? 0
  }});
}
return out;
```

#### Prompt do AI Agent (warmup envio)

```
Você é um redator corporativo especializado em emails curtos e naturais
para comunicação interna/entre empresas nos EUA.
Sua tarefa é gerar um assunto (subject) e um corpo de email em HTML
com conteúdo aleatório, realista e profissional, sobre temas comuns
do dia a dia de empresas.

Regras obrigatórias:
- Gere o conteúdo em inglês (US).
- O email deve parecer uma conversa normal de trabalho (não marketing),
  com 60 a 140 palavras.
- Não use linguagem de venda, gatilhos de promoção, nem palavras como:
  sale, discount, free, buy now, limited time.
- Varie o tema aleatoriamente entre: Follow-up, Confirmação de recebimento,
  Ajuste de agenda, Pedido de confirmação, Status update, Feedback,
  Pergunta sobre fatura, Alinhamento de escopo, Agradecimento.
- Use um tom amigável e profissional.
- Estrutura HTML: use apenas <p>, <br>, <strong>. Assinatura curta no final.
  Não invente dados reais.

Formato de saída: {"subject": "...", "html": "..."}
```

**Modelo:** `gpt-4.1-mini`
**Temperatura:** default (não setado)

#### Switch1 — 3 senders Gmail hardcoded (rede paralela à do pt2!)

```
$json.Sender === "abigail.parker@gbestcleaning.info" → "abigail"
$json.Sender === "hannah.reed@gbestcleaning.info"   → "hannah"
$json.Sender === "emily.carter@gbestcleaning.info"  → "emily"
```

> ⚠️ **IMPORTANTE:** dominio aqui é `gbestcleaning.info` — diferente dos do pt2 (`gbccleaning.com`/`gbcleaning.space`/`gbcleaning.online`). Esses 3 são uma rede de warmup separada, não usados em dispatch real. Apesar do SQL pegar TODOS os senders Resend/Google da `sender_emails`, o switch hardcoded só lida com esses 3.

#### `Create a row` em email_warmup_interactions

```
Table: email_warmup_interactions
Fields:
  thread_id: [sender_email, receiver_email].sort().join('_')
  sender: sender_email
  receiver: receiver_email
  interaction_type: 'sent'
  interaction_order: 0
  max_interactions: Math.floor(Math.random() * 3) + 1   // 1-3
```

> Isso explica o `thread_id` em `email_warmup_interactions`: é determinístico baseado nos 2 emails. Mesma thread se cruza dos dois lados.

---

### 18.4 Warmup recebimento — `Aquecimento de email(recebimento)` (bTuTALx2EDDqBrxK)

#### Webhook — DESCONECTADO

```
POST /webhook/recebeaq
```
Existe mas `connections` é vazio. Os triggers reais são GmailTrigger.

#### Gmail Triggers — 3 contas

| Node | Account | Pollmode |
|---|---|---|
| `Abigail` | abigail.parker@gbestcleaning.info | every minute |
| `Emily` | emily.carter@gbestcleaning.info | every minute |
| `Hannah1` | hannah.reed@gbestcleaning.info | every minute |

> **Para o Nest:** substituir por uma das 3 estratégias do `DECISÃO ABERTA #10` (Pub/Sub, IMAP polling, ou N8N proxy). Cada uma tem trade-offs detalhados em §13.

#### `Extrair dados do email` — extrai metadata

```
email_from:           $json.from.value[0].address
email_name:           $json.from.value[0].name
email_subject:        $json.subject
email_body:           $json.html
thread_id:            $json.threadId
email_revived:        $json.to.value[0].address  // typo no original
email_name_recived:   parsed from to[0].address
id_mensage:           $json.id
```

#### `buscar_sender_email` — SQL pra resolver thread

```sql
SELECT 
  i.sender AS remetente_email,
  COALESCE(se1.display_name, i.sender) AS remetente_nome,
  i.receiver AS destinatario_email,
  COALESCE(se2.display_name, i.receiver) AS destinatario_nome,
  i.interaction_type,
  i.interaction_order,
  i.max_interactions
FROM email_warmup_interactions i
LEFT JOIN sender_emails se1 ON se1.email_address = i.sender
LEFT JOIN sender_emails se2 ON se2.email_address = i.receiver
WHERE i.thread_id = '{{ [from, to[0]].sort().join('_') }}'
ORDER BY i.created_at DESC
LIMIT 1;
```

#### Reply HTTP — `enviar_reply`

```
POST https://api.resend.com/emails
Headers:
  Authorization: Bearer <REDACTED-RESEND-KEY>
  Content-Type: application/json
Body:
{
  "from": "{{ destinatario_nome }} <{{ destinatario_email }}>",
  "to": ["{{ remetente_email }}"],
  "subject": "Re: {{ webhook.body.data.subject }}",
  "html": "{{ ai_generated_html }}",
  "reply_to": "{{ destinatario_email }}",
  "headers": {
    "In-Reply-To": "{{ webhook.body.data.message_id }}",
    "References":  "{{ webhook.body.data.message_id }}"
  }
}
```

> **Importante:** thread headers (`In-Reply-To`, `References`) são preservados. Migração precisa fazer o mesmo, senão Gmail/Outlook não agrupa no mesmo thread.

#### If / If1 — quando parar de responder

```
$json.destinatario_email IS NOT EMPTY
AND
$json.interaction_order != $json.max_interactions
```

> Cada thread tem `max_interactions` 1-3 random. Quando `interaction_order == max_interactions`, para de responder. Isso evita loop infinito de auto-replies.

#### Wait

```
{{ Math.floor(Math.random() * 100) }} minutes  // 0-99 min
```

> Delay grande pra parecer humano. Migrar pra BullMQ delayed job com mesma faixa.

---

### 18.5 LinkedIn send — `[Linkedin] envio de mensagem` (estBS0PmeL1hFpDe)

#### Webhook

```
POST /webhook/disparar-mensagens
```

Responde imediatamente:
```json
{
  "status": "processing",
  "message": "Disparo iniciado para {{ profiles.length }} perfis",
  "total": "{{ profiles.length }}"
}
```

#### Profile lookup (Unipile)

```
GET https://api26.unipile.com:15613/api/v1/users/{public_identifier}?account_id={account_id}&linkedin_sections=*
Headers:
  X-API-KEY: <REDACTED-UNIPILE-KEY>
  accept: application/json
```

#### Decisão crítica — `If` (message vs invite)

```
$('Buscar perfil do usuario').item.json.is_relationship === true
```

- **TRUE** (já conectado) → Edit Fields → `Manda msg Direto`
- **FALSE** (não conectado) → `Enviar invite`

#### Mensagem hardcoded (DM)

```
"I run a commercial cleaning team in your area and wanted to ask if you 
already have a company handling your cleaning, or if you might need a 
quote sometime soon?"
```

> Mesma vibe das mensagens do dispatch (GBC Cleaning).

#### Send DM

```
POST https://api26.unipile.com:15613/api/v1/chats
Headers:
  X-API-KEY: <REDACTED-UNIPILE-KEY>
  Content-Type: application/json
Body:
{
  "account_id": "{{ webhook.account_id }}",
  "text": "{{ message }}",
  "attendees_ids": "{{ profile.provider_id }}"
}
```

#### Send invite

```
POST https://api26.unipile.com:15613/api/v1/users/invite
Headers:
  X-API-KEY: <REDACTED-UNIPILE-KEY>
  Content-Type: application/json
Body:
{
  "provider_id": "{{ profile.provider_id }}",
  "account_id": "{{ webhook.account_id }}",
  "message": "{{ webhook.invite_message }}"
}
```

#### Anti-spam (BUG B3)

```
Get a row em linkedin_messages WHERE chat_id = $json.chat_id
↓
If1: conditions vazias!
```

> ⚠️ **BUG:** o `If1` deveria checar `Get a row` retornou linha existente, mas suas conditions estão vazias (`leftValue: ""`, `rightValue: ""`). **Anti-spam não funciona.** Reportar a Leonardo.

---

### 18.6 Search — `[email] Pesquisa V1` (nNEGPw9Eb4suATn3)

#### Webhook

```
POST /webhook/search
Body: { region, keywords, industry, campaign }
```

#### Pipeline

1. **Geocoding (RapidAPI):**
```
GET https://maps-data.p.rapidapi.com/geocoding.php?query={region}&lang=en&country=us
Headers: x-rapidapi-key: <REDACTED-RAPIDAPI>
→ retorna lat/lng
```

2. **Maps search (RapidAPI):**
```
GET https://local-business-data.p.rapidapi.com/search-nearby
?query={industry},{keywords}
&lat={lat}&lng={lng}
&limit=100&language=en&region=us
&extract_emails_and_contacts=true
Headers: x-rapidapi-key: <REDACTED-RAPIDAPI>
→ retorna até 100 empresas com emails, telefones, redes sociais
```

3. **Normalização (Code):** transforma response em records `{business_id, name, type, verified, ratings, phones, emails, website, address, owner, social_networks}`

4. **AI classifier (gpt-4.1-mini):**
```
Você é um especialista em análise de perfis corporativos.
Analise endereços de e-mail para determinar se provavelmente
pertencem a um decisor (diretores, fundadores, C-levels).

Output:
email: xxx@yyy.com
Probabilidade: Alta | Média | Baixa
nome: [extracted]
dominio: [extracted]
```

5. **Score filter:** Alta=3, Média=2, Baixa=1. Mantém score ≥ 2.

6. **Email verification (RapidAPI):**
```
GET https://verify-email-pro.p.rapidapi.com/check?email={email}
→ retorna email_valid boolean
```

7. **Insert em `emails` (Supabase):**

⚠️ **BUG B2 confirmado** — o node `Edit Fields` tem:
```
"user_id": "0e632f97-5c20-4d53-a22e-b5935185c810"  // HARDCODED!
```

Independente de quem chamou o webhook, o lead vai pra esse user. Isso é um break de multi-tenant. **Onda 6 precisa receber `user_id` no body do webhook (do JWT do front) e usar esse, não hardcoded.**

#### Nodes órfãos (Brevo) — não migrar

`cria_contato` e `envia email transacional` apontam pra Brevo (`api.brevo.com/v3/contacts`, `/v3/smtp/email`) com sender hardcoded `leuhsouza@gmail.com → patrickandreia2505@gmail.com`. Parece teste manual do dono. Não cabe no escopo.

---

### 18.7 zera limite — `[Tigger] - zera limite` (G1G1DkHf7GrU79us)

**Cron:** `interval: [{}]` — n8n default (provavelmente a cada hora). ⚠️ Verificar no painel; pode estar configurado pra frequência diferente da pretendida (sticky note diz "zera os limites de 15 emails", sugerindo daily).

**Operações (sequenciais):**

```sql
-- Update 1
UPDATE sender_emails SET today_usage = 0 WHERE today_usage != 0;

-- Update 2
UPDATE email_warmup_interactions SET max_interactions = 0 WHERE max_interactions != 0;
```

> ⚠️ **BUG B11:** o segundo UPDATE zera `max_interactions` em **toda** a tabela. Isso quebra a condição de parada do warmup recv (`interaction_order != max_interactions` fica sempre verdadeira). **Não migrar esse comportamento.**
>
> **Para o Nest:** Onda 1 implementa só o primeiro UPDATE. O segundo é bug.

---

### 18.8 SmartLead Atualiza-base — `[SmartLead] - Atualiza-base` (8CamkGMPY06aiLQ7)

**Webhook:** `POST /webhook/smartlead`

**Origem confirmada:** payload pinned mostra header `x-origin-system: Smartlead` vindo de IP `13.238.115.211` (axios/0.19.2). Sender real visto: `victoria@scalesops.co` (não é parte da rede GBC Cleaning principal — outro user/projeto).

**Switch — 4 ramos por `body.event_type`:**

| Event | UPDATE em `emails` |
|---|---|
| `EMAIL_SENT` | `client_step='first_send'`, `status='sent'`, `our_last_reply=html`, `date_sent=NOW()`, `sender_email_id=se.id`, `dispatch_platform='smartlead'` |
| `EMAIL_BOUNCE` | mesma + `client_step='finished'`, `status='bounced'` |
| `EMAIL_OPEN` | `client_step='first_send'`, `status='opened'`, `our_last_reply=html` |
| `EMAIL_REPLY` | `client_step='first_send'`, `status='replied'`, `our_last_reply=html` |

**SQL (todos os 4 ramos seguem o mesmo padrão):**

```sql
UPDATE emails e
SET 
    client_step = '{step}',
    status = '{status}',
    our_last_reply = '{{ body.sent_message.html }}',
    date_sent = NOW(),
    sender_email_id = se.id,
    dispatch_platform = 'smartlead'
FROM sender_emails se
WHERE e.email = '{{ body.to_email }}'
  AND se.email_address = '{{ body.from_email }}';
```

> ⚠️ **BUG B12:** `our_last_reply` recebe HTML do email enviado (`body.sent_message.html`), não da resposta. Nome misleading. Para o Nest: usar `email_messages` (direction='outbound') em vez de poluir `our_last_reply`.
>
> ⚠️ **SQL injection visível** — interpolação de string em SQL bruto. Use parameterized query no Nest.

**Payload exemplo (capturado em prod):**

```json
{
  "event_type": "EMAIL_SENT",
  "from_email": "victoria@scalesops.co",
  "to_email": "hr@corebridge.net",
  "to_name": "Raquel H.",
  "campaign_name": "Teceiro 201/300  15/04/2026",
  "campaign_id": 3179150,
  "sequence_number": 1,
  "custom_subject": "Building cleaning question",
  "sent_message": {
    "message_id": "<86b262ae-872d-49c7-ba1e-77b5f0e22926@scalesops.co>",
    "html": "<div>Hey Raquel...</div>",
    "text": "Hey Raquel...",
    "time": "2026-04-15T14:02:10.599+00:00"
  },
  "subject": "Building cleaning question",
  "secret_key": "<REDACTED-SMARTLEAD-SECRET>"
}
```

> Para Nest: implementar como `WebhookPayloadParser<SmartLead>` que normaliza pra `NormalizedEmailEvent` (§18.2).

---

### 18.9 LinkedIn events — `[linkedin] Recebe eventos mensagens` (8FaGelWVDKyoAS7r)

**Webhook:** `POST /webhook/linkedin-messages`

**Lógica (2 paths):**

```
If1: body.event === 'message_read'
   ├── TRUE  → UPDATE linkedin_messages SET status='read', read_at=timestamp
   │           WHERE message_id = body.message_id
   └── FALSE → If: body.sender.attendee_id === "GZO2tjQaWvKb3Y17_z8AnQ"
              ├── TRUE  → (vazio — sou eu, ignorar)
              └── FALSE → UPDATE linkedin_messages
                          SET response_content = body.message,
                              replied_at = timestamp,
                              response_message_id = body.message_id,
                              status = 'replied'
                          WHERE chat_id = body.chat_id
```

> ⚠️ **BUG B13 confirmado:** `attendee_id` `GZO2tjQaWvKb3Y17_z8AnQ` é hardcoded — provavelmente o ID Unipile da conta LinkedIn do Leonardo. Multi-tenant break: outros users do CEP que conectarem suas próprias contas LinkedIn vão ter mensagens **suas** (do Leonardo) aparecendo como "replies".
>
> ⚠️ **BUG B16 confirmado:** UPDATE é por `chat_id`, não `message_id`. Mensagens novas no mesmo chat sobrescrevem `response_content`.
>
> **Para Nest:** resolver `attendee_id` consultando `linkedin_accounts` (campo `account_id`) pelo `body.account_id` do payload, não hardcoded.

**Payload exemplo (capturado em prod):**

```json
{
  "event": "message_received",
  "account_id": "9QBVp5WkTw28DtZpv25EWQ",
  "account_type": "LINKEDIN",
  "chat_id": "vawyJtddUUaY3L3T2y5weA",
  "sender": {
    "attendee_id": "pX9oRq2VUL6Jm8mG3eGPVg",
    "attendee_name": "Leonardo Souza",
    "attendee_provider_id": "ACoAABD-GsYB97m66GTGPmhB3suSHFAP6I2v54U"
  },
  "message": "Oi sofia",
  "message_id": "pdCeMjwaVo-3KTNs_WyX2w",
  "timestamp": "2026-02-15T03:38:00.421Z",
  "is_sender": false
}
```

---

### 18.10 `[descarte]` workflows — Unipile auth + callback

#### `UBXSpTG6kyijdzaw` — `[descarteLinkedin]`

**Webhook:** `POST /webhook/linkedin-campaign`

**Faz:** POST `https://{{body.dsn}}/api/v1/hosted/accounts/link` com header `X-API-KEY: {{body.access-token}}`. Body cria auth link Unipile.

> ⚠️ **BUG B15:** o body do POST tem placeholders **literais não substituídos**:
> ```json
> "api_url": "https://{SEU_DSN}",
> "notify_url": "https://seu-n8n.com/webhook/linkedin-conectado",
> "success_redirect_url": "https://seusite.com/sucesso",
> "failure_redirect_url": "https://seusite.com/erro"
> ```
> Se Unipile usa `notify_url`, vai pra um domínio inválido. **OAuth flow provavelmente quebrado** desde que esse workflow foi criado.

**Substituto correto:** [app/api/unipile-auth/route.ts](../app/api/unipile-auth/route.ts) no Next. Validate `notify_url` é `NEXT_PUBLIC_APP_URL`.

#### `6hgCvqOmiAoFjQG7` — `[descarte]Uniple-conexão`

**Webhook:** `POST /webhook/linkedin-conectado`

**Faz:** INSERT em `linkedin_accounts` com `client_id=body.name`, `account_id=body.account_id`, `status=body.status`. **Sem HMAC, sem qualquer auth.**

> ⚠️ **BUG B14 confirmado:** qualquer requisição POST nessa URL adiciona linha em `linkedin_accounts`. Substituto seguro: [app/api/unipile-callback/route.ts](../app/api/unipile-callback/route.ts) tem HMAC com `timingSafeEqual`. **Mas o N8N velho continua ativo aceitando.**
>
> **Ação:** Onda 7 — confirmar via logs Unipile que `notify_url` aponta pro Next, depois desligar workflow N8N. Se Unipile ainda aponta pra N8N: **fix urgente** (URLs hardcoded no painel Unipile).

---

### 18.11 Auditoria de segredos vazados

> **Os 6 valores reais foram VISTOS pelo auditor mas não estão neste documento.** Receiver Claude deve assumir que **todas estão comprometidas** e o owner precisa **rotacionar** as 6.

| # | Provider | Onde aparecia | Forma de exposição |
|---|---|---|---|
| 1 | **Resend** | pt1 (sticky note), follow-ups (HTTP header), warmup envio (HTTP × 2), warmup recv (HTTP) | `Authorization: Bearer re_...` em texto plano |
| 2 | **Zapmail** | pt1 (sticky note), pt2 (HTTP header) | `x-auth-zapmail: ...` em texto plano |
| 3 | **SmartLead** | pt2 (Edit Fields7 da Saga órfã) | query param `?api_key=...` em URLs |
| 4 | **Unipile** | LinkedIn send (3 HTTP nodes: profile lookup, send DM, send invite) | `X-API-KEY: ...` em texto plano |
| 5 | **RapidAPI** | search (3 HTTP nodes: geoloc, maps, verify-email) | `x-rapidapi-key: ...` em texto plano |
| 6 | **Brevo** | search (2 HTTP órfãos: cria_contato, envia email transacional) | `api-key: xkeysib-...` em texto plano |

**Ação imediata recomendada (antes de qualquer migração):**
1. Revogar TODAS as 6 keys nos respectivos painéis
2. Gerar novas
3. **No N8N**: mover pras Credentials (não em sticky notes nem headers HTTP literais)
4. **No Nest**: usar env vars + `@nestjs/config` com Zod schema validando que estão presentes em boot

---

### 18.12 Resumo prático para implementação

| Onda | Conteúdo extraído utilizável |
|---|---|
| **Onda 1 (zera limite)** | §18.7 — implementar APENAS o UPDATE em `sender_emails.today_usage`. Ignorar o segundo UPDATE (B11 — bug). |
| **Onda 2 (eventos)** | §18.2 (Resend/etc) + §18.8 (SmartLead) — 4 tipos de evento por provider + bug B4 + lookup por `email_address` (escapando `From: Name <addr>`). SmartLead webhook precisa entrar nessa onda. |
| **Onda 3 (warmup)** | §18.3 (envio) + §18.4 (recv) — prompts OpenAI (porta direto), randomizador, schema email_warmup_interactions, max_interactions, Wait random 0-99min |
| **Onda 4 (dispatch)** | §18.1 — 3 templates + lógica de tipos + Resend payload + Zapmail payload + Wait pacing 90-150s + quota 15/dia. **Não migrar Saga SmartLead** (era pra criar campanhas no SmartLead automaticamente, abandonado). |
| **Onda 6 (search + follow-ups)** | §18.6 — pipeline RapidAPI completo + AI classifier + bug B2 (user_id hardcoded) + cron `0 12 * * 1-4` (segunda-quinta 12h) + sequência `first_send→follow_1→follow_2→finish` (do follow-ups extraído inline na conversa) |
| **Onda 7 (LinkedIn)** | §18.5 (send) + §18.9 (events) + §18.10 (descarte) — Unipile profile lookup + decisão is_relationship + Send DM/Invite endpoints + bug B3 (anti-spam quebrado), B13 (attendee_id hardcoded), B16 (chat_id update sobrescreve histórico). Confirmar URLs no Unipile painel + desligar `[descarte]` workflows. |

---

> **Última verificação contra estado vivo:** 2026-05-09. Re-rode §5 antes de assumir que segue válido.
