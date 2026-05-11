# Cold Email Pro — Resumo do novo Backend

> Documento para **qualquer pessoa do time** (não-técnica também) entender:
> 1. O que foi feito
> 2. Como funciona o novo backend
> 3. Como ele substitui o N8N (e por quê)

---

## 1. Visão geral em 1 parágrafo

O Cold Email Pro hoje roda em cima de uma plataforma chamada **N8N**, que orquestra os envios de email, follow-ups, warmup, integrações com LinkedIn, etc. O N8N é bom para protótipos, mas tem problemas sérios quando a operação cresce: **não tem retentativa automática, não avisa quando algo falha, schedules ficam "fantasmas" sem disparar, e os mesmos workflows são compartilhados com outros projetos** — instabilidade em um afeta os outros. A solução é construir um **backend novo em NestJS** que assume essas responsabilidades de forma robusta, observável, escalável e segura — e desligar o N8N gradualmente.

---

## 2. Por que sair do N8N (em fatos)

Auditoria feita em 2026-05-09 sobre o sistema real:

| Problema | Evidência | Impacto |
|---|---|---|
| **5 em 20 envios recentes falharam em silêncio** | Logs `pt2` no N8N | Leads perdidos, ninguém soube |
| **Schedules "ativos" que nunca rodaram** | 2 schedules no banco com `last_run_at: NULL` e horário em março/2026 | Cliente cria agendamento, mas ninguém dispara |
| **10 leads marcados como "responderam"… mas zero conteúdo da resposta gravado** | Tabela `emails` com `response_content` vazio | Impossível fazer chat thread no app |
| **Warmup rodando em contas Gmail hardcoded** (Abigail / Hanna / Emily) | Dentro do workflow N8N, fora do controle do produto | Cliente novo não consegue ligar warmup nele mesmo |
| **6 API keys vazadas em texto plano** no N8N (Resend, Zapmail, Unipile, RapidAPI, Brevo, SmartLead secret) | Sticky notes / headers HTTP | Segurança: qualquer um com acesso ao painel rouba |
| **17 bugs documentados em produção** | Auditoria detalhada — ex: multi-tenant break, anti-spam quebrado, callback sem HMAC | Riscos legais + funcionais |

Conclusão: **o N8N entregou o MVP, mas escalar com ele é insustentável.**

---

## 3. O que é o novo backend (em termos simples)

É um **servidor de aplicação** escrito em [NestJS](https://nestjs.com/) — um framework Node.js usado por empresas grandes (Adidas, Roche, Capgemini, etc.). Ele recebe pedidos do front-end Next.js e dos webhooks dos provedores (Resend, SmartLead, Unipile, etc.), e:

- **Dispara emails de verdade** chamando o provedor certo (Resend, Zapmail, SES, etc.)
- **Agenda envios** com cron próprio (não depende mais do "Wait" do N8N)
- **Ouve eventos** dos provedores (entregue, aberto, bounced, replied) e atualiza o banco
- **Faz aquecimento de caixa** (warmup) com IA gerando emails naturais
- **Faz follow-up automático** de leads que não responderam
- **Gerencia LinkedIn** via Unipile (mensagens diretas + convites)
- **Tenta de novo automaticamente** quando algo falha (com backoff exponencial)
- **Avisa via Sentry** quando algo der errado de verdade
- **Loga tudo** com mascaramento de senhas/chaves

O front Next.js **não muda nada** — ele continua chamando os mesmos endpoints, só que apontando pra URL nova.

---

## 4. Arquitetura em uma figura mental

```
       Usuário (front Next.js)
              │
              ▼
       ┌──────────────────┐
       │  NestJS Backend  │ ◄────── webhooks (Resend, SmartLead, Unipile)
       │   (este projeto) │
       └────────┬─────────┘
                │
       ┌────────┼─────────────┐
       ▼        ▼             ▼
   Postgres   Redis        Provedores
  (Supabase)  (filas)      (Resend, OpenAI,
                            Unipile, etc.)
```

**Postgres (Supabase)** → guarda leads, senders, templates, schedules, mensagens.
**Redis** → guarda a fila de jobs (envios pendentes, retentativas, etc.) usando o **BullMQ**.
**Provedores externos** → quem efetivamente entrega o email / DM / dado de pesquisa.

---

## 5. Como o backend é construído (módulos)

O sistema é dividido em **pedaços com responsabilidades claras**:

| Módulo | O que faz |
|---|---|
| **Auth** | Verifica que quem chamou tem login válido no Supabase |
| **Health** | Página `/health` que mostra se Postgres e Redis estão de pé |
| **Leads** | CRUD de leads (a tabela `emails`) |
| **Senders** | CRUD das caixas de envio + cron diário que **zera contadores às 00:00** |
| **Templates** | CRUD de templates de email + sorteio aleatório entre variantes |
| **Schedules** | CRUD de agendamentos + cron que dispara a cada minuto + correção de timezone |
| **Dispatch** | Núcleo: recebe payload do front, enfileira, despacha um por um, retentando se falhar |
| **Providers/Email** | 7 "estratégias" — Resend, Zapmail, SMTP, SES, Mailgun, Google, Outlook — atrás da mesma interface |
| **Providers/LinkedIn** | Adapter pra API da Unipile |
| **Webhooks** | Recebe os eventos dos provedores e atualiza o banco (com proteção anti-duplicação) |
| **Inbox** | Mantém a "thread" da conversa de cada lead (tabela `email_messages` — **nova**) |
| **Warmup** | Aquecimento de caixa, chamando o `warmup-budget` do Supabase + IA da OpenAI |
| **Follow-ups** | Cron que segunda-quinta às 12h checa quem não respondeu e manda follow-up |
| **AI** | Wrapper da OpenAI com prompts prontos pro warmup |
| **Analytics** | Endpoint que delega pras RPCs Postgres existentes (dashboard do front) |
| **Search** | Endpoint `/search` que enriquece leads com Maps + IA + verificação de email |
| **LinkedIn** | Disparo de DM/invite via Unipile + recepção de eventos |

---

## 6. Plano de substituição do N8N — 7 ondas

A migração segue a estratégia **strangler fig** (figueira-estranguladora): o novo backend cresce ao lado do N8N, vai assumindo workflow por workflow, e quando uma "onda" está estável em produção por 3+ dias, o workflow N8N daquela onda é **desligado**. Nunca há um "big bang" — sempre há rollback fácil.

| Onda | Escopo | O que entrega | Status agora |
|---|---|---|---|
| **0** | Fundação | Servidor sobe, autentica, conecta DB e Redis, deploya no Railway | ✅ **Pronto** |
| **1** | Cron "zera limite" | Substitui o workflow `[Tigger] - zera limite` (zera contadores diários) | ✅ **Pronto** |
| **2** | Webhook de eventos + tabela de mensagens | Recebe reply/bounce/open de Resend e SmartLead, grava a thread de conversa | 🟡 Esqueleto pronto, parsers funcionais |
| **3** | Warmup completo (reescrita) | Aquecimento real plugado nas contas do cliente, com IA gerando email e auto-pause em caso de bounce | 🟡 Estrutura pronta, falta worker |
| **4** | Dispatch (coração do envio) | Front manda payload → backend enfileira → entrega via provedor certo, com retry e pacing | 🟡 Endpoint + worker prontos, Resend/Zapmail/SMTP funcionais |
| **5** | Agendamentos | Cron server-side que dispara os schedules na hora certa, respeitando timezone do usuário | 🟡 Cron rodando, integração com dispatch falta |
| **6** | Follow-ups + Pesquisa | Cron de follow-up + endpoint `/search` (Maps + IA + verify-email) | 🟡 Stubs no lugar |
| **7** | LinkedIn (Unipile) | Mensagens DM/invite + ingestão de eventos LinkedIn com multi-tenant correto | 🟡 Stubs no lugar |

> **Hoje** (final desta sessão): ondas 0 e 1 estão funcionais, e ondas 2–7 têm a estrutura, contratos e código de plumbing prontos. Cada onda subsequente é **incremental** — preenchemos o worker / use case / persistência sem mexer no resto.

---

## 7. Decisões importantes tomadas

| # | Decisão | Por quê |
|---|---|---|
| 1 | **Prisma como ORM**, não Drizzle | Pedido explícito do usuário, contrariando o brief |
| 2 | **Versões mais recentes** de tudo (NestJS 11, TypeScript 5.7, Prisma 6) | Pedido do usuário |
| 3 | **Tenant isolado no warmup** (cada cliente, sua rede) | Hoje há 1 cliente, mas o plano é escalar — pool compartilhado entre clientes pode ter trade-offs sérios de reputação. Pool por tenant é o caminho seguro. |
| 4 | **Edge Function `warmup-budget` mantida** no Supabase | Funciona, é determinística, reimplementar em Node seria desperdício |
| 5 | **SmartLead apenas como provider externo** que webhooka eventos | A saga de criação de campanha no SmartLead estava órfã no N8N, foi cortada |
| 6 | **OpenAI direto** (sem LangChain) | Brief é categórico — LangChain adiciona peso sem ganho aqui |
| 7 | **Timezone via payload do front** (não TZ do container) | Multi-tenant futuro pode ter clientes em fusos diferentes |

---

## 8. O que ainda falta antes de produção

1. **Rotacionar as 6 API keys vazadas** no N8N (bug B1 do brief) — antes de qualquer deploy.
2. **Rodar `prisma db pull`** contra o Postgres de produção e reconciliar o `schema.prisma` com o estado real (o `schema.prisma` atual foi montado a partir do brief — pode ter drift).
3. **Investigar os 5/20 errors do `pt2`** (decisão #2) — saber o que está falhando hoje antes de migrar.
4. **Configurar webhooks no painel** de cada provider apontando pra URL nova:
   - Resend → `https://api.coldmail.../webhooks/email-events?provider=resend`
   - SmartLead → `https://api.coldmail.../webhooks/email-events?provider=smartlead`
   - Unipile → `https://api.coldmail.../linkedin/webhooks/unipile`
5. **Trocar `NEXT_PUBLIC_WEBHOOK_N8N`** no front (Vercel env) pra URL do novo backend — só na onda 4.
6. **Manter `DISPATCH_VIA_N8N=true`** como feature flag por 7 dias após o cutover, pra rollback rápido.

---

## 9. Riscos endereçados explicitamente

| Risco | Mitigação |
|---|---|
| Envio cair e perder leads | Retry automático com backoff exponencial (3 tentativas), DLQ pro Sentry |
| Provedor (Resend/Unipile) ficar instável | Circuit breaker — para de tentar e re-tenta em 30s |
| Webhook do provedor entregar 2× o mesmo evento | Idempotency: índice único em `(provider_message_id, direction)` |
| Schedule disparar no horário errado por timezone | `ScheduleClock` calcula sempre na timezone do usuário |
| Token vazar nos logs | Pino com lista de campos sensíveis para masking automático |
| Crash não notificar ninguém | Sentry capturando 5xx e exceções não-tratadas |
| Lead de um cliente entrar na rede de warmup de outro | Pareamento é tenant-scoped (decisão #16) |

---

## 10. Glossário rápido

| Termo | Significado |
|---|---|
| **NestJS** | Framework Node.js, organizado em módulos, usado por times maduros |
| **Fastify** | Servidor HTTP usado internamente — ~2× mais rápido que Express |
| **Prisma** | ORM (camada que conversa com o banco) com tipagem automática |
| **BullMQ** | Sistema de filas em cima do Redis — garante que jobs não se percam e tente de novo |
| **Redis** | Banco em memória ultra-rápido — guarda a fila de jobs |
| **Sentry** | Serviço que captura erros e notifica o time |
| **Pino** | Sistema de logs estruturados em JSON, rápido e com mascaramento |
| **HMAC** | Forma matemática de assinar requisições — quem não tem o segredo, não consegue forjar |
| **Idempotency** | Garantia de que mesma operação feita 2× não duplica o resultado |
| **Circuit breaker** | Padrão que "abre o circuito" depois de N falhas, evitando martelar um serviço caído |
| **Strangler fig** | Estratégia de substituição gradual — sistema novo cresce ao lado do velho até ele morrer sozinho |
| **Cron** | Tarefa que roda em horário fixo (ex: todo dia 00:00) |
| **DLQ (Dead-Letter Queue)** | Fila pra onde vão jobs que falharam todas as retentativas — pra inspeção manual |
| **Multi-tenant** | Suportar múltiplos clientes isolados no mesmo sistema |
| **Webhook** | Forma de um serviço externo te avisar de eventos — eles fazem POST na sua API |

---

## 11. Em uma frase

> **"Estamos trocando uma orquestração frágil e compartilhada (N8N) por um backend dedicado, observável e tolerante a falhas — sem o cliente final perceber, e podendo voltar atrás a qualquer momento."**

---

*Documento gerado em 2026-05-10 como parte do scaffolding inicial. Atualizar a cada onda concluída.*
