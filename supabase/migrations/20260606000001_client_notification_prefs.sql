-- =============================================================================
-- Client notification preferences
--
-- One row per client, controlling which notifications they receive.
-- Defaults: all enabled.
-- Covers both push (Expo) and email (Resend) channels.
-- =============================================================================

-- ── 1. Preferences table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_notification_prefs (
  client_id             uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  new_message           boolean NOT NULL DEFAULT true,
  checkin_day_before    boolean NOT NULL DEFAULT true,
  checkin_day_of        boolean NOT NULL DEFAULT true,
  checkin_comment       boolean NOT NULL DEFAULT true,
  daily_log_reminder    boolean NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Auto-insert defaults when a client row is created ─────────────────────
CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.client_notification_prefs (client_id)
  VALUES (NEW.id)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_notification_prefs ON public.clients;
CREATE TRIGGER trg_create_notification_prefs
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_prefs();

-- ── 3. Backfill existing clients ─────────────────────────────────────────────
INSERT INTO public.client_notification_prefs (client_id)
SELECT id FROM public.clients
ON CONFLICT (client_id) DO NOTHING;

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.client_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client read own notif prefs"
  ON public.client_notification_prefs FOR SELECT
  USING ((SELECT auth.uid()) IN (
    SELECT user_id FROM public.clients WHERE id = client_id
  ));

CREATE POLICY "client update own notif prefs"
  ON public.client_notification_prefs FOR UPDATE
  USING ((SELECT auth.uid()) IN (
    SELECT user_id FROM public.clients WHERE id = client_id
  ));

-- Service role can read all (needed by edge functions)
CREATE POLICY "service role full access notif prefs"
  ON public.client_notification_prefs
  USING (true)
  WITH CHECK (true);

-- ── 5. Index ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notif_prefs_client ON public.client_notification_prefs (client_id);

-- ── 6. Fix send_client_push_checkins trigger ─────────────────────────────────
-- The old trigger sent {type:'UPDATE', table:'checkins', record, old_record}
-- but the edge function expects {type:'checkin_comment', client_id, message, checkin_id}.
-- Fix: send the custom payload that the edge function already handles correctly.

CREATE OR REPLACE FUNCTION public.send_client_push_checkins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret   text;
  request_id bigint;
BEGIN
  -- Only fire when trainer_comment is newly set (not blank, not unchanged)
  IF (OLD.trainer_comment IS NOT DISTINCT FROM NEW.trainer_comment) THEN RETURN NEW; END IF;
  IF NEW.trainer_comment IS NULL OR length(trim(NEW.trainer_comment)) = 0 THEN RETURN NEW; END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'webhook_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING 'send_client_push_checkins: webhook_secret not found in Vault';
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url     := 'https://nvlrlubvxelrwdzggmno.supabase.co/functions/v1/send-client-push',
    body    := jsonb_build_object(
      'type',       'checkin_comment',
      'client_id',  NEW.client_id,
      'checkin_id', NEW.id,
      'message',    left(coalesce(NEW.trainer_comment, ''), 200)
    ),
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    )
  ) INTO request_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_client_push_checkins() FROM PUBLIC;

-- ── 7. pg_cron jobs ──────────────────────────────────────────────────────────
-- Use a helper function so we can fetch webhook_secret from vault inside cron context.

CREATE OR REPLACE FUNCTION public.trigger_client_reminders(reminder_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'webhook_secret';

  PERFORM net.http_post(
    url     := 'https://nvlrlubvxelrwdzggmno.supabase.co/functions/v1/client-reminders',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object('type', reminder_type)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_client_reminders(text) FROM PUBLIC;

-- Check-in reminders: 08:00 UTC every day
-- (day-before for those whose check-in day is tomorrow,
--  day-of for those whose check-in day is today and haven't submitted)
SELECT cron.schedule(
  'client-checkin-reminders',
  '0 8 * * *',
  'SELECT public.trigger_client_reminders(''checkin'')'
);

-- Daily log reminder: 20:00 UTC = 22:00 CET (summer) / 21:00 CET (winter)
SELECT cron.schedule(
  'client-daily-log-reminder',
  '0 20 * * *',
  'SELECT public.trigger_client_reminders(''daily_log'')'
);
