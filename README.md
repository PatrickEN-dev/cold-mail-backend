# Coldmail Backend

> Backend NestJS substituindo, em **7 ondas**, os workflows N8N do produto **Cold Email Pro**.
> Fonte da verdade do escopo: [`nestjs-backend-brief.md`](./nestjs-backend-brief.md) (1902 linhas).
> Resumo para leigos: [`docs/RESUMO_NEGOCIO.md`](./docs/RESUMO_NEGOCIO.md) + [`docs/RESUMO_NEGOCIO.html`](./docs/RESUMO_NEGOCIO.html) (imprime para PDF).

---

## Estado atual

| Categoria | Status |
|---|---|
| Boot end-to-end | ✅ Prisma + Redis conectam, 30+ rotas + `/metrics` |
| `typecheck` | ✅ 0 erros |
| `lint` | ✅ 0 erros |
| `test` | ✅ 22/22 (incluindo rate-limiter, parser Resend, pacing) |
| `build` | ✅ 121 arquivos compilados (SWC) |
| Schema Prisma ↔ Supabase real | ✅ alinhado via MCP introspection 2026-05-11 |
| Observabilidade (`/metrics` Prometheus) | ✅ |
| Smoke `/health`, `/senders` (401), `/webhooks/...` (403) | ✅ |

| Onda | Conteúdo | Status |
|---|---|---|
| **0** — Fundação | Fastify + JWT Supabase + Prisma + BullMQ + Pino + Sentry + Health + Prometheus | ✅ Funcional |
| **1** — Cron reset-limits | `UPDATE sender_emails.today_usage=0` à meia-noite (TZ São Paulo) | ✅ Funcional |
| **2** — Webhooks + `email_messages` | Parsers Resend/SmartLead + HMAC com **raw body** + idempotency + ingest use case (sem duplo count) | ✅ Funcional, falta cutover |
| **3** — Warmup | `WarmupBudgetClient` + pairing tenant-scoped + crons 3x/dia + prompts OpenAI | 🟡 Esqueleto + plumbing |
| **4** — Dispatch | `POST /dispatch` + worker BullMQ (addBulk) + 7 provider strategies + **reserva atômica de quota** + **rate-limit Resend 5/s** + **pacing per-sender** | ✅ Funcional, falta cutover |
| **5** — Schedules | `ScheduleClock` TZ-aware + cron tick a cada minuto + `FireScheduleUseCase` (conectado ao Dispatch) | ✅ Funcional, falta DDL `tz` em prod |
| **6** — Follow-ups + Search | Cron Mon-Thu 12h + `POST /search` + `AnalyticsService` com queries diretas | 🟡 Stubs com plumbing |
| **7** — LinkedIn (Unipile) | `POST /linkedin/messages` + webhook com HMAC + UnipileProvider | 🟡 Stubs |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 11 + Fastify 5 |
| Linguagem | TypeScript 5.7 (strict) |
| ORM | **Prisma 6** (override do brief) |
| DB | Postgres (Supabase em prod / local em dev) |
| Filas | BullMQ + Redis |
| Cron | `@nestjs/schedule` |
| Validação | Zod |
| Auth | JWT Supabase verificado localmente (HS256 via `jose`) |
| Email | Resend, Zapmail, SMTP (nodemailer), SES, Mailgun (Google/Outlook stub) |
| LinkedIn | Unipile via `undici` |
| AI | OpenAI direto (sem LangChain) |
| Logs | Pino estruturado, com **redaction automática de secrets** |
| Erros | Sentry + filter global (Domain + fallback) |
| HTTP out | `undici` + `cockatiel` (retry + timeout + circuit breaker) |
| Testes | Vitest + testcontainers |
| Deploy | Docker → Railway |

---

## Arquitetura

```
src/
├── infra/
│   ├── cache/           Redis (ioredis)
│   ├── config/          Env Zod-validado + TypedConfigService
│   ├── database/        PrismaService (usa pool URL quando disponível)
│   ├── observability/   Pino + Sentry exception filter
│   └── queue/           5 BullMQ queues registradas
├── shared/
│   ├── domain/          Entity, ValueObject, AggregateRoot, DomainEvent
│   ├── errors/          DomainError + filter global
│   ├── events/          Catálogo de domain events (§7.4 do brief)
│   ├── http/            HMAC verification (timing-safe)
│   └── pipes/           ZodValidationPipe
└── modules/
    ├── auth/            APP_GUARD global, @CurrentUser, @Public
    ├── health/          /health (Postgres + Redis checks)
    ├── leads/           CRUD `emails`
    ├── senders/         CRUD + cron reset-daily-usage (Onda 1)
    ├── templates/       CRUD + pickRandomVariant
    ├── schedules/       CRUD + ScheduleClock + cron tick (Onda 5)
    ├── dispatch/        SendBatch (addBulk) + SendOne (reserva atômica) (Onda 4)
    ├── providers/
    │   ├── email/       Strategy: 7 implementations + ResilientEmailProvider
    │   └── linkedin/    UnipileProvider
    ├── webhooks/        Parsers + HMAC raw body + IngestEmailEventUseCase (Onda 2)
    ├── inbox/           email_messages thread API
    ├── warmup/          WarmupBudgetClient + pairing + crons (Onda 3)
    ├── follow-ups/      Cron Mon-Thu 12h (Onda 6)
    ├── ai/              OpenAI provider + prompts verbatim do brief
    ├── analytics/       Pass-through pras RPCs Supabase
    ├── search/          POST /search (Onda 6)
    └── linkedin/        Send DM/Invite + webhook Unipile (Onda 7)
```

### Padrões aplicados
- **Strategy** — providers de email (Resend/Zapmail/SMTP/SES/Mailgun/Google/Outlook) atrás de `IEmailProvider`.
- **Repository** — 1 por aggregate, isola Prisma.
- **Use case** — `SendBatchUseCase`, `SendOneUseCase`, `IngestEmailEventUseCase` etc.
- **Adapter** — Unipile, OpenAI envoltos numa interface estável.
- **Circuit Breaker / Retry / Timeout** — `ResilientEmailProvider` via `cockatiel`.
- **Idempotency Key** — webhook ingest dedupe por `(provider_message_id, direction)`.
- **Domain Events** — `EventEmitter2` interno, evita acoplamento entre módulos.
- **Reserva atômica de quota** — `today_usage++` via `updateMany WHERE today_usage < dailyLimit` evita race entre workers.

---

## Setup rápido

### Pré-requisitos

- Node.js 20+
- Postgres 16 local **ou** Supabase
- Redis 7+

### Subir tudo

```bash
# 1. Dependências
npm install
npm run prisma:generate

# 2. Copiar e preencher env
cp .env.example .env
# Editar .env — preencher SUPABASE_JWT_SECRET, RESEND_API_KEY, OPENAI_API_KEY (mínimos)

# 3. Postgres local (uma opção)
brew services start postgresql@16
createdb coldmail
npm run prisma:migrate:dev

# 4. Redis local (uma opção)
brew services start redis
# alternativa: docker compose up redis

# 5. Rodar
npm run start:dev
```

API sobe em `http://localhost:4000`. Confirme:
```bash
curl http://localhost:4000/health
# {"status":"ok","checks":{"postgres":{"ok":true},"redis":{"ok":true}},...}
```

### Via Docker Compose

```bash
docker compose up redis                    # só Redis
docker compose --profile local-db up       # Redis + Postgres local
docker compose --profile app up            # tudo + API container
```

---

## Comandos

```bash
npm run start:dev               # dev com watch
npm run start                   # roda sem watch
npm run build                   # compila pra dist/
npm run start:prod              # roda dist/main.js (produção)

npm run typecheck               # tsc --noEmit
npm run lint                    # eslint --fix
npm test                        # vitest run
npm run test:watch
npm run test:cov

npm run prisma:generate         # gera @prisma/client
npm run prisma:migrate:dev      # nova migration em dev
npm run prisma:migrate:deploy   # aplica migrations em prod
npm run prisma:pull             # introspect do DB → schema.prisma
npm run prisma:studio           # UI de browsing
```

---

## Sincronização com Supabase

> **Recomendação forte:** antes de produção, sincronizar o `schema.prisma` com o estado **real** do Postgres do Supabase.

O `schema.prisma` atual foi construído a partir das tabelas descritas em `nestjs-backend-brief.md §6.1 + §10`. Pra reconciliar com prod:

```bash
# 1. Apontar DATABASE_URL pro Supabase (substituir [SUA-SENHA])
export DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.kxgwviiewmnmignqmptu.supabase.co:5432/postgres

# 2. Introspect
npm run prisma:pull

# 3. Diff e ajustar campos faltantes/extras
git diff prisma/schema.prisma

# 4. Regenerar client
npm run prisma:generate
```

**Tabelas críticas pra conferir contra prod** (brief §6.1):

| Tabela | Cuidados |
|---|---|
| `emails` | tem ~40 colunas em prod; o schema atual só modela as referenciadas pelos workflows. Pull vai trazer todas. |
| `sender_emails` | conferir `platform` CHECK constraint e `today_usage` default |
| `email_warmup_interactions` | sem `user_id` em prod (RLS via JOIN). Conferir. |
| `schedules` | adicionar coluna `tz text NOT NULL DEFAULT 'America/Sao_Paulo'` na Onda 5 |
| `email_messages` | **não existe em prod** ainda — vai ser criada pela primeira migration aplicada (esta) |

**RPCs preservadas** (chamadas pelo front via `supabase.rpc()` — não migrar):
- `calculate_lead_quality_score`
- `pipeline_metrics`
- `sender_email_stats`
- `user_campaign_names`

**Edge Function mantida** — `warmup-budget` (Supabase Edge). Backend consome via HTTPS, não reimplementa (decisão #5 do brief).

---

## Decisões e overrides do brief

| # | Decisão | Onde está |
|---|---|---|
| Stack | **Prisma** em vez de Drizzle (pedido do usuário) | `prisma/schema.prisma` |
| Stack | **Latest** em vez dos pinos do brief (NestJS 11, TS 5.7, Prisma 6) | `package.json` |
| #16 | **Warmup tenant-scoped** (pares só dentro do mesmo `userId`) | [`warmup-pairing.ts`](src/modules/warmup/application/warmup-pairing.ts) |
| #5 | Edge Function `warmup-budget` mantida (consumida via HTTPS) | [`warmup-budget.client.ts`](src/modules/warmup/warmup-budget.client.ts) |
| #4 | SmartLead **só recebe webhook**, não envia | parsers/smartlead |
| #8 | OpenAI direto (sem LangChain) | [`openai.provider.ts`](src/modules/ai/openai.provider.ts) |
| #9 | Timezone via payload do front (`tz` em `schedules`) | [`schedule-clock.ts`](src/modules/schedules/application/schedule-clock.ts) |
| #14 | Pacing via `delay` por job (não rateLimit global) | [`send-batch.use-case.ts`](src/modules/dispatch/application/send-batch.use-case.ts) |
| Bug B11 | Cron **NÃO migra** o `UPDATE max_interactions=0` (era bug) | [`reset-daily-usage.use-case.ts`](src/modules/senders/application/reset-daily-usage.use-case.ts) |
| Bug B4 | Reply ingestion **persiste body** em `email_messages` (legacy não persistia) | [`ingest-email-event.use-case.ts`](src/modules/webhooks/application/ingest-email-event.use-case.ts) |
| — | Quota anti-race via reserva atômica | [`send-one.use-case.ts`](src/modules/dispatch/application/send-one.use-case.ts) |
| — | HMAC com **raw body do Fastify** (não re-serializa) | [`webhooks.controller.ts`](src/modules/webhooks/webhooks.controller.ts) |

---

## Cobertura dos workflows N8N (mapeamento)

Os 13 workflows do CEP confirmados via MCP N8N hoje (2026-05-11):

| Workflow N8N | Módulo Nest correspondente | Status |
|---|---|---|
| `GIFZ8zzIWiXGdral` pt1 Split | `DispatchModule.SendBatchUseCase` (entry payload §6.2.1) | ✅ |
| `jhzBrpA2g5mYOMon` pt2 Send Email | `DispatchModule.SendOneUseCase` + ResilientEmailProvider | ✅ |
| `NkZO6yq9LeKVBnbs` Webhook eventos + recv | `WebhooksModule.WebhooksController` + `IngestEmailEventUseCase` | ✅ |
| `8CamkGMPY06aiLQ7` SmartLead Atualiza-base | `WebhooksModule.SmartLeadWebhookParser` | ✅ |
| `GaDxY8f5dQnP0LG4` Warmup envio | `WarmupModule.WarmupTickCron` + WarmupBudgetClient | 🟡 plumbing |
| `bTuTALx2EDDqBrxK` Warmup recv | `WarmupModule` (TODO worker) | 🟡 plumbing |
| `0x9tjMCXLxba1LqZ` Follow-ups | `FollowUpsModule.FollowUpsTickCron` | 🟡 plumbing |
| `G1G1DkHf7GrU79us` zera limite | `SendersModule.ResetDailyUsageCron` | ✅ |
| `estBS0PmeL1hFpDe` LinkedIn envio | `LinkedInModule.LinkedInController` + UnipileProvider | 🟡 plumbing |
| `8FaGelWVDKyoAS7r` LinkedIn eventos | `LinkedInModule` webhook | 🟡 plumbing |
| `nNEGPw9Eb4suATn3` Pesquisa V1 | `SearchModule.SearchController` | 🟡 stub |
| `UBXSpTG6kyijdzaw` descarte LinkedIn auth | **fica no Next** (decisão #11) | ✅ |
| `6hgCvqOmiAoFjQG7` descarte Unipile callback | **fica no Next** (decisão #11) | ✅ |

### Erros legacy diagnosticados via MCP
- **`pt2` workflow tinha 5/20 erros silenciosos** = **HTTP 429 Rate Limited do Resend**. Não é bug nosso; é falha de design do N8N (10 execuções paralelas batem o limite de 5 req/s). **No backend novo isso é resolvido pelo `ResendEmailProvider.rateLimiter` (5 req/s) + pacing per-sender de 90-150s entre envios.**
- **Template GBC Cleaning tem typo** em prod: `<p>Best,<br>\nbr>\nGBC Cleaning...` (faltou o `<` antes do segundo `br>`). Quando migrar pra `email_templates` aplicando pull, vale revisar.

## Próximas ondas

1. **`prisma:pull`** contra Supabase prod periodicamente pra detectar drift (último alinhamento: 2026-05-11).
2. **Onda 2 cutover** — configurar webhooks Resend/SmartLead apontando pra `${BACKEND_PUBLIC_URL}/webhooks/email-events?provider=...`. **Aplicar primeiro a migration `002_create_email_messages.sql`** em `prisma/manual-migrations/`. Validar 3 dias em paralelo com N8N, desligar workflow `NkZO6yq9LeKVBnbs`.
3. **Onda 4 cutover** — trocar `NEXT_PUBLIC_WEBHOOK_N8N` (Vercel) pra `${BACKEND_PUBLIC_URL}/dispatch`. Manter `DISPATCH_VIA_N8N=true` 7 dias pra rollback rápido.
4. **Onda 5 finalize** — aplicar `001_add_tz_to_schedules.sql` e remover o TODO no `SchedulesTickCron` que hardcode `'America/Sao_Paulo'`.
5. **Preencher worker BullMQ do warmup** (Onda 3): `warmup.tick` → enumera `sender_warmups` enabled → consulta budget → enfileira `warmup.send`.
6. **Rotacionar as 6 API keys vazadas** no N8N (bug B1) antes de subir o backend novo em prod.

---

## Variáveis de ambiente

Ver [`.env.example`](.env.example). Categorias e o que é obrigatório:

| Categoria | Obrigatório | Notas |
|---|---|---|
| Runtime | `PORT`, `FRONTEND_URL` | Defaults seguros |
| DB | `DATABASE_URL` | `DATABASE_POOL_URL` é opcional (fallback pra DATABASE_URL) |
| Supabase Auth | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, **`SUPABASE_JWT_SECRET`** | JWT secret é crítico — sem ele o guard não valida tokens |
| Redis | `REDIS_URL` | |
| Webhooks | `WEBHOOK_HMAC_SECRET` (≥16 chars) | Outros são opcionais (Unipile/Zapmail/SmartLead) |
| Email providers | (todos opcionais) | App boota sem; só falha se um sender configurado tentar usar provider sem key |
| AI | `OPENAI_API_KEY` (opcional) | Necessário em Onda 3 (warmup) e Onda 6 (search) |
| Observability | (todos opcionais) | `SENTRY_DSN` recomendado em prod |
| Feature flags | (defaults seguros) | `DISPATCH_VIA_N8N`, `ENABLE_*_CRON/WORKER` |

---

## Bugs do brief endereçados nesta implementação

| # | Bug | Como foi tratado |
|---|---|---|
| B1 | API keys vazadas no N8N | Centralizado em `.env`, redact automático no Pino |
| B2 | `/search` com `user_id` hardcoded | Controller usa `@CurrentUser()` (Onda 6) |
| B4 | Reply ingestion não persistia body | `email_messages` direction='inbound' com body completo |
| B5 | Follow-up só rodava pra Resend | Cron (stub) vai filtrar por `status` independente de `dispatch_platform` |
| B11 | Cron zerava `max_interactions=0` (quebrava warmup) | Cron novo só zera `today_usage` |
| B12 | `our_last_reply` reusada pra HTML enviado | Agora vai pra `email_messages` direction='outbound' |
| B13 | LinkedIn events com `attendee_id` hardcoded | Stub usa lookup por `account_id` autenticado |
| B14 | Callback Unipile sem HMAC | `POST /linkedin/webhooks/unipile` valida HMAC com `timingSafeEqual` |
| — | Race em quota (5/20 erros silenciosos do pt2) | Reserva atômica via `updateMany WHERE today_usage < dailyLimit` |

---

## Observabilidade

| Sinal | Endpoint / Mecanismo | Notas |
|---|---|---|
| Health | `GET /health` (público) | Postgres + Redis checks |
| Métricas Prometheus | `GET /metrics` (público) | scrape interval típico 15-30s |
| Logs estruturados | stdout (Pino JSON) | secrets automaticamente redacted; níveis: `LOG_LEVEL=info\|debug\|...` |
| Erros 5xx | Sentry (se `SENTRY_DSN` setado) | exception filter global |

### Métricas customizadas expostas em `/metrics`

- `coldmail_dispatch_total{provider, status}` — counter por envio (success / failure)
- `coldmail_provider_send_duration_seconds{provider, status}` — histograma de duração
- `coldmail_sender_quota_skips_total{provider}` — vezes que um envio foi pulado por dailyLimit
- `coldmail_webhook_events_total{provider, event, outcome}` — eventos recebidos por tipo
- `coldmail_node_*` — métricas default do Node (CPU, memória, event loop lag, GC)

## Documentação adicional

- [`nestjs-backend-brief.md`](./nestjs-backend-brief.md) — brief original (1902 linhas), fonte de verdade do escopo.
- [`docs/RESUMO_NEGOCIO.md`](./docs/RESUMO_NEGOCIO.md) — overview executivo para leigos.
- [`docs/RESUMO_NEGOCIO.html`](./docs/RESUMO_NEGOCIO.html) — versão imprimível em PDF (Cmd+P → "Salvar como PDF").
