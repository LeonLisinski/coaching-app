-- Secure webhook triggers for send-client-push Edge function.
--
-- Replaces three Database Webhooks that had credentials hardcoded:
--   "send-client-push"       on messages       (had service role JWT + old secret)
--   notify_checkin_comment   on checkins        (had weak hardcoded secret)
--   notify_new_package       on client_packages (had weak hardcoded secret)
--
-- Secret is read from Supabase Vault by name ("webhook_secret").
-- Run the ONE-TIME SETUP below BEFORE this migration.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  ONE-TIME SETUP — run in SQL Editor, do NOT commit to git               │
-- │                                                                         │
-- │  SELECT vault.create_secret(                                            │
-- │    '<your-new-secret>',                                                 │
-- │    'webhook_secret',                                                    │
-- │    'x-webhook-secret for send-client-push Edge function'                │
-- │  );                                                                     │
-- │                                                                         │
-- │  Verify: SELECT name FROM vault.secrets WHERE name = 'webhook_secret'; │
-- └─────────────────────────────────────────────────────────────────────────┘

-- ── Prereq ────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Drop old triggers (had hardcoded credentials) ────────────────────────────
DROP TRIGGER IF EXISTS "send-client-push"     ON public.messages;
DROP TRIGGER IF EXISTS notify_checkin_comment ON public.checkins;
DROP TRIGGER IF EXISTS notify_new_package     ON public.client_packages;

-- Drop any matching functions (harmless if they don't exist)
DROP FUNCTION IF EXISTS public."send-client-push"()        CASCADE;
DROP FUNCTION IF EXISTS public.send_client_push()          CASCADE;
DROP FUNCTION IF EXISTS public.notify_checkin_comment()    CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_package()        CASCADE;
DROP FUNCTION IF EXISTS public.send_client_push_messages() CASCADE;
DROP FUNCTION IF EXISTS public.send_client_push_checkins() CASCADE;
DROP FUNCTION IF EXISTS public.send_client_push_packages() CASCADE;

-- ── messages → push to client when trainer sends a message ───────────────────
CREATE OR REPLACE FUNCTION public.send_client_push_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret     text;
  request_id   bigint;
BEGIN
  -- Skip if client is the sender (trainer-only notifications)
  IF NEW.sender_id IS NULL OR NEW.sender_id = NEW.client_id THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'webhook_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING 'send_client_push_messages: webhook_secret not found in Vault';
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url     := 'https://nvlrlubvxelrwdzggmno.supabase.co/functions/v1/send-client-push',
    body    := jsonb_build_object(
      'type',       'message',
      'client_id',  NEW.client_id,
      'message',    left(coalesce(NEW.content, ''), 200),
      'message_id', NEW.id
    ),
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    )
  ) INTO request_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_send_client_push_messages
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.send_client_push_messages();

-- ── checkins → push to client when trainer adds a comment ────────────────────
CREATE OR REPLACE FUNCTION public.send_client_push_checkins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret     text;
  request_id   bigint;
BEGIN
  -- Only fire when trainer_comment was actually changed to a non-empty value
  IF (OLD.trainer_comment IS NOT DISTINCT FROM NEW.trainer_comment) THEN
    RETURN NEW;
  END IF;
  IF NEW.trainer_comment IS NULL OR length(trim(NEW.trainer_comment)) = 0 THEN
    RETURN NEW;
  END IF;

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
      'message',    left(NEW.trainer_comment, 200)
    ),
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    )
  ) INTO request_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_send_client_push_checkins
AFTER UPDATE OF trainer_comment ON public.checkins
FOR EACH ROW
EXECUTE FUNCTION public.send_client_push_checkins();

-- ── client_packages → push to client when package becomes active ──────────────
CREATE OR REPLACE FUNCTION public.send_client_push_packages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret       text;
  request_id     bigint;
  is_new_active  boolean;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    is_new_active := (NEW.status = 'active');
  ELSE
    is_new_active := (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active');
  END IF;

  IF NOT is_new_active THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'webhook_secret';

  IF v_secret IS NULL THEN
    RAISE WARNING 'send_client_push_packages: webhook_secret not found in Vault';
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url     := 'https://nvlrlubvxelrwdzggmno.supabase.co/functions/v1/send-client-push',
    body    := jsonb_build_object(
      'type',              'package',
      'client_id',         NEW.client_id,
      'client_package_id', NEW.id,
      'message',           'Novi aktivni paket'
    ),
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    )
  ) INTO request_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_send_client_push_packages
AFTER INSERT OR UPDATE OF status ON public.client_packages
FOR EACH ROW
EXECUTE FUNCTION public.send_client_push_packages();

-- ── Prevent direct calls to trigger functions ─────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.send_client_push_messages() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_client_push_checkins() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_client_push_packages() FROM PUBLIC;
