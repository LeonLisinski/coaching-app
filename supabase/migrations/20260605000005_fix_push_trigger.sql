-- =============================================================================
-- Fix send_client_push_messages trigger:
--   1. Correct skip condition: was `sender_id = client_id` which NEVER matches
--      because sender_id is auth.users.id and client_id is clients.id (different
--      UUID namespaces). Fix: skip when sender is NOT the trainer.
--   2. Add trainer_id to the payload so the edge function can fetch the trainer
--      name without a separate DB lookup by message_id.
--
-- No changes to checkins or packages triggers — they were correct.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.send_client_push_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret   text;
  request_id bigint;
BEGIN
  -- Only notify when the trainer sends a message (sender_id = trainer_id).
  -- Previously compared sender_id = client_id, which is always false because
  -- sender_id is an auth.users UUID and client_id is a clients-table UUID.
  IF NEW.sender_id IS NULL OR NEW.sender_id <> NEW.trainer_id THEN
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
      'trainer_id', NEW.trainer_id,
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

REVOKE EXECUTE ON FUNCTION public.send_client_push_messages() FROM PUBLIC;
