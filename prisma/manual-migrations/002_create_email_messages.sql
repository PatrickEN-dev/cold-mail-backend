-- Wave 2: new inbox thread table. Replaces the abuse of
-- emails.response_content / our_last_reply that the legacy N8N flow did.

CREATE TABLE IF NOT EXISTS public.email_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id            uuid NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,

  thread_id           text,
  provider_message_id text,
  in_reply_to         text,

  direction           text NOT NULL CHECK (direction IN ('outbound','inbound')),

  from_address        text NOT NULL,
  from_name           text,
  to_address          text NOT NULL,
  subject             text,
  body_text           text,
  body_html           text,

  provider            text,
  sent_at             timestamptz NOT NULL,
  received_at         timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_messages_email_id_created_at_idx
  ON public.email_messages (email_id, created_at);

CREATE INDEX IF NOT EXISTS email_messages_user_id_idx
  ON public.email_messages (user_id);

-- Idempotency for webhook ingestion (brief §10.1).
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_dedupe
  ON public.email_messages (provider_message_id, direction)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant isolation" ON public.email_messages;
CREATE POLICY "tenant isolation"
  ON public.email_messages
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
