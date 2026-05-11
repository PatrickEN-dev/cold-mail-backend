-- Wave 5: store the IANA timezone per schedule so next_run_at calculation
-- is correct under a UTC Railway runtime (brief §8 Onda 5.1).

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS tz text NOT NULL DEFAULT 'America/Sao_Paulo';

COMMENT ON COLUMN public.schedules.tz IS
  'IANA timezone name used by the backend cron to compute next_run_at.';
