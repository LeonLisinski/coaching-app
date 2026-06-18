-- ── 1. RLS policies for tables with RLS enabled but no policies ───────────────
-- kpp_entries: service role only (internal KPP tracking)
CREATE POLICY "service role kpp_entries"
  ON public.kpp_entries
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- reminder_sent: service role only (written by cron/server, never by clients)
CREATE POLICY "service role reminder_sent"
  ON public.reminder_sent
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ── 2. Revoke EXECUTE from trigger functions that must not be called directly ─
-- These are AFTER TRIGGER functions, never meant to be called via RPC.
REVOKE EXECUTE ON FUNCTION public.contact_messages_touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_client_reminders(text) FROM anon, authenticated;

-- ── 3. Ensure remaining notify/trigger functions revoked from anon ─────────────
-- (Belt-and-suspenders: previous migration may have been partially applied)
REVOKE EXECUTE ON FUNCTION public.create_default_notification_prefs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_trainer_on_checkin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_trainer_on_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_trainer_on_lead() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_chat_media_on_message_delete() FROM anon;
