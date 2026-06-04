-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening: SECURITY DEFINER functions
--
-- All five functions below are SECURITY DEFINER and were previously executable
-- by the anon and authenticated roles directly via /rest/v1/rpc/...
-- This migration:
--   1. Re-creates mark_trial_used_once (not in prior migrations) and
--      next_kpp_seq with service_role-only guards via auth.uid() checks.
--   2. Revokes execute privilege from PUBLIC / anon / authenticated.
--   3. Grants execute exclusively to service_role.
--
-- Note: enforce_active_via_api is a TRIGGER function (RETURNS trigger).
-- It cannot be called directly via RPC — Postgres itself enforces this.
-- The REVOKE below is a belt-and-suspenders measure; the runtime guard
-- (auth.uid() IS NOT NULL blocks authenticated sessions from flipping
-- clients.active directly) remains intact in the trigger body.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Re-create mark_trial_used_once as plpgsql with service_role guard ─────
--    Original was LANGUAGE sql (no IF support). Converted to plpgsql.
--    Signature: (p_user_id uuid, p_at timestamptz)
CREATE OR REPLACE FUNCTION mark_trial_used_once(
  p_user_id UUID,
  p_at      TIMESTAMP WITH TIME ZONE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only service_role (auth.uid() IS NULL) may call this function.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden: must be called via service_role';
  END IF;

  UPDATE profiles
  SET trial_used_at = COALESCE(trial_used_at, p_at)
  WHERE id = p_user_id;
END;
$$;

-- ── 2. Re-create next_kpp_seq as plpgsql with service_role guard ──────────────
--    Also defined in 20260602000001_kpp_entries.sql (idempotent CREATE OR REPLACE).
--    Repeated here to ensure the guard is applied even if migrations run selectively.
--    Signature: (p_year integer DEFAULT EXTRACT(YEAR FROM now())::integer)
CREATE OR REPLACE FUNCTION next_kpp_seq(
  p_year int DEFAULT EXTRACT(YEAR FROM now())::int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden: must be called via service_role';
  END IF;

  RETURN (
    SELECT COALESCE(
      MAX(
        (regexp_match(rbr, E'^\\d{2}-(\\d+)-'))[1]::int
      ), 0
    ) + 1
    FROM kpp_entries
    WHERE rbr LIKE (LPAD((p_year % 100)::text, 2, '0') || '-%')
  );
END;
$$;

-- ── 3. Revoke public execute access ──────────────────────────────────────────
-- PostgreSQL matches function overloads by signature, so full type lists are
-- required. enforce_active_via_api has no parameters (trigger function).

REVOKE EXECUTE ON FUNCTION insert_client_with_overage_peak(
  uuid, uuid, text, date, numeric, numeric, text, text, text, integer
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION set_active_with_overage_peak(
  uuid, uuid, integer
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION mark_trial_used_once(
  uuid, timestamp with time zone
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION next_kpp_seq(
  integer
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION enforce_active_via_api()
FROM PUBLIC, anon, authenticated;

-- ── 4. Grant execute exclusively to service_role ──────────────────────────────

GRANT EXECUTE ON FUNCTION insert_client_with_overage_peak(
  uuid, uuid, text, date, numeric, numeric, text, text, text, integer
) TO service_role;

GRANT EXECUTE ON FUNCTION set_active_with_overage_peak(
  uuid, uuid, integer
) TO service_role;

GRANT EXECUTE ON FUNCTION mark_trial_used_once(
  uuid, timestamp with time zone
) TO service_role;

GRANT EXECUTE ON FUNCTION next_kpp_seq(
  integer
) TO service_role;

GRANT EXECUTE ON FUNCTION enforce_active_via_api()
TO service_role;
