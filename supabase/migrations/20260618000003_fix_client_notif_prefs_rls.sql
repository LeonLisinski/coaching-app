-- The 'service role full access notif prefs' policy was applying to ALL roles
-- which effectively bypassed RLS for everyone. Fixed to service_role only.
DROP POLICY IF EXISTS "service role full access notif prefs" ON public.client_notification_prefs;

CREATE POLICY "service role full access notif prefs"
  ON public.client_notification_prefs
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
