-- Expo push tokens for mobile clients (iOS / Android).
-- One token per client — upserted on every app launch / login.
-- Used by Edge Functions (delete-account, send-client-push) to send
-- notifications via the Expo Push API (https://exp.host/--/api/v2/push/send).

CREATE TABLE IF NOT EXISTS public.expo_push_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid        NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  token      text        NOT NULL,
  platform   text        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_client
  ON public.expo_push_tokens (client_id);

COMMENT ON TABLE public.expo_push_tokens IS
  'Expo push tokens for client mobile app — one active token per client.';

-- RLS: clients can only read/write their own token row;
-- service role (edge functions) bypasses RLS entirely.
ALTER TABLE public.expo_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can upsert own token"
  ON public.expo_push_tokens
  FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );
