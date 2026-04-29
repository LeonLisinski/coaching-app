-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening part 2
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Revoke EXECUTE from PUBLIC on trigger functions ────────────────────────
-- PostgreSQL grants EXECUTE to PUBLIC by default. Revoking from named roles
-- (anon, authenticated) alone is not enough — PUBLIC still covers them.
-- These are DB-internal trigger functions, not meant to be called via REST/RPC.
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()   FROM PUBLIC;

-- get_trainer_subscription_active IS called by the authenticated mobile app
-- via /rest/v1/rpc/. Keep authenticated access, revoke only anon + public.
REVOKE EXECUTE ON FUNCTION public.get_trainer_subscription_active(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_trainer_subscription_active(uuid) TO authenticated;

-- ── 2. Drop avatars bucket SELECT policy ─────────────────────────────────────
-- Public buckets serve files via CDN URL without any Storage policy.
-- The SELECT policy only enables API listing (/storage/v1/object/list/avatars)
-- which is not needed — avatar URLs are accessed directly, not listed.
-- Removing this policy silences the "public_bucket_allows_listing" warning
-- while keeping all avatar URLs publicly accessible via CDN.
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars"              ON storage.objects;
