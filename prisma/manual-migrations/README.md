# Manual migrations

SQL files in this folder are **NOT** applied automatically by Prisma. They are
applied to Supabase (prod) via `mcp__supabase__apply_migration` or via the
Supabase Dashboard SQL editor.

Each file is idempotent (`IF NOT EXISTS` / safe drops) so re-running is harmless.

| # | File | Status | Description |
|---|---|---|---|
| 001 | `001_add_tz_to_schedules.sql` | ⏳ Pending | Adds `schedules.tz` column. Apply when Wave 5 reaches multi-tz support. |
| 002 | `002_create_email_messages.sql` | ✅ Applied 2026-05-11 (`create_email_messages`) | Created the inbox thread table used by Wave 2. |
| 003 | `003_backfill_linkedin_accounts_user_id.sql` | ⏳ Pending (manual data fix) | Backfill the 2 legacy rows in `linkedin_accounts` that have `user_id IS NULL`. |

The migration `add_user_id_to_linkedin_accounts` (which added the nullable
`user_id` column with FK to `auth.users`) was also applied 2026-05-11 directly
via MCP — its SQL is the simple ADD COLUMN below, not committed as a numbered
file because it was conceived inline.

```sql
ALTER TABLE public.linkedin_accounts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS linkedin_accounts_user_id_idx ON public.linkedin_accounts (user_id);
```

After applying any of these to prod, refresh the local Prisma client with
`pnpm prisma db pull && pnpm prisma generate` and commit the resulting schema
delta in the same PR.
