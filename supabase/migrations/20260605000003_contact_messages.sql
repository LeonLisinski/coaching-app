-- =============================================================================
-- contact_messages: stores submissions from the unitlift.com/kontakt form.
-- Written by coaching-app-web/app/api/contact/route.ts via service_role.
-- Read/managed by the admin panel at admin.unitlift.com/support.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  subject     TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'novo'
                          CHECK (status IN ('novo', 'u_obradi', 'rijeseno')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for the admin inbox (ordered by created_at desc, filtered by status)
CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx
  ON public.contact_messages (status);

-- updated_at auto-touch trigger
CREATE OR REPLACE FUNCTION public.contact_messages_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS contact_messages_updated_at ON public.contact_messages;
CREATE TRIGGER contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.contact_messages_touch_updated_at();

-- RLS: deny all authenticated/anon; admin panel uses service_role (bypasses RLS)
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_contact_messages" ON public.contact_messages;
CREATE POLICY "deny_all_contact_messages"
  ON public.contact_messages FOR ALL
  USING (false)
  WITH CHECK (false);
