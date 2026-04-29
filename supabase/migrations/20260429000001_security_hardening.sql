-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening — addresses Supabase advisor warnings
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Fix mutable search_path on update_updated_at ──────────────────────────
-- Supabase lint: function_search_path_mutable
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 2. Fix mutable search_path on handle_new_user ────────────────────────────
-- Supabase lint: function_search_path_mutable
-- Recreate with fully-qualified table names (required when search_path = '').
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 3. Revoke EXECUTE from anon on trigger/internal functions ─────────────────
-- These are SECURITY DEFINER trigger functions — they should never be called
-- via REST/GraphQL by unauthenticated users.
-- Supabase lint: anon_security_definer_function_executable
REVOKE EXECUTE ON FUNCTION public.handle_new_user()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_client_push_messages()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_client_push_checkins()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_client_push_packages()    FROM anon, authenticated;

-- get_trainer_subscription_active IS called by the authenticated mobile app
-- but should NOT be callable by anonymous users.
REVOKE EXECUTE ON FUNCTION public.get_trainer_subscription_active(uuid) FROM anon;

-- ── 4. Fix admin_vault RLS — restrict to service role only ───────────────────
-- Supabase lint: rls_policy_always_true
-- The "Admin full access to vault" policy uses USING (true) which lets every
-- authenticated user read/write this table. Restrict to service role.
DROP POLICY IF EXISTS "Admin full access to vault" ON public.admin_vault;
CREATE POLICY "Service role only" ON public.admin_vault
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS entirely, so it retains full access.

-- ── 5. Fix avatars bucket — restrict listing to authenticated users only ──────
-- Supabase lint: public_bucket_allows_listing
-- Drop the overly broad "Anyone can view avatars" policy and replace it with
-- a policy that only allows authenticated users to SELECT (read URLs + list).
-- Object URLs remain publicly accessible via the CDN regardless of this policy.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- ── 6. Revoke anon SELECT from all data tables ────────────────────────────────
-- Supabase lint: pg_graphql_anon_table_exposed (35 tables)
-- The app never queries data tables with the anon key — all data access
-- requires a valid JWT (authenticated role). Revoking anon SELECT:
--   a) removes tables from the GraphQL schema for unauthenticated requests
--   b) prevents unauthenticated REST queries even if RLS is misconfigured
-- RLS policies remain in place as a second layer of defense.
REVOKE SELECT ON
  public.admin_notes,
  public.admin_tasks,
  public.admin_vault,
  public.bug_log,
  public.checkin_config,
  public.checkin_parameters,
  public.checkin_templates,
  public.checkins,
  public.client_meal_plans,
  public.client_packages,
  public.client_tracked_checkin_parameters,
  public.client_tracked_exercises,
  public.client_workout_plans,
  public.clients,
  public.daily_checkins,
  public.daily_logs,
  public.exercises,
  public.expo_push_tokens,
  public.foods,
  public.mailer_campaigns,
  public.meal_plans,
  public.meals,
  public.messages,
  public.nutrition_logs,
  public.packages,
  public.payments,
  public.processed_webhook_events,
  public.profiles,
  public.push_subscriptions,
  public.recipes,
  public.reminder_sent,
  public.subscriptions,
  public.trainer_overrides,
  public.trainer_profiles,
  public.weekly_checkins,
  public.workout_logs,
  public.workout_plans,
  public.workout_sessions,
  public.workout_templates
FROM anon;
