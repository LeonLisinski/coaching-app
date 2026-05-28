-- ─────────────────────────────────────────────────────────────────────────────
-- Billing reliability fixes
--
-- 1. max_overage_blocks: tracks the peak Scale overage block count reached in
--    the current billing period. The cron reports this value to Stripe (not the
--    live active-client count), so deactivating clients before the daily cron
--    runs can never erase a peak that was already confirmed and paid for.
--    Reset to 0 only when a NEW billing period starts (invoice.billing_reason
--    IN ('subscription_cycle', 'subscription_create') in the webhook).
--    NOT reset on prorated invoices from upgrades/downgrades.
--
-- 2. enforce_active_via_api trigger: prevents authenticated Supabase sessions
--    from directly changing clients.active. All active/inactive changes must go
--    through /api/clients/[id]/set-active or the create-client edge function,
--    both of which run as service_role and enforce plan limits + overage rules.
--
-- 3. Atomic RPCs: the peak update and the client activation/insert happen in a
--    single database transaction so they can never partially succeed.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Peak overage tracking
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS max_overage_blocks INT NOT NULL DEFAULT 0;

-- 2. Trigger function: block direct active-status changes from client sessions
CREATE OR REPLACE FUNCTION enforce_active_via_api()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- auth.uid() is NULL when called via service_role (server API routes).
  -- It is non-NULL for any authenticated client-side request.
  -- Authenticated sessions may NOT directly flip the active column.
  IF (NEW.active IS DISTINCT FROM OLD.active) AND (auth.uid() IS NOT NULL) THEN
    RAISE EXCEPTION
      'client active status can only be changed via the server API (plan limits and overage confirmation required)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_active_via_api_trigger ON clients;
CREATE TRIGGER enforce_active_via_api_trigger
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION enforce_active_via_api();

-- 3a. Atomic activation + peak update for an EXISTING client row.
--     Used by set-active route (all activations) and create-client reactivation path.
--     Both the subscription peak update and the clients.active flip happen in the
--     same transaction — either both succeed or neither does.
CREATE OR REPLACE FUNCTION set_active_with_overage_peak(
  p_trainer_id UUID,
  p_client_id  UUID,
  p_blocks     INT      -- pass 0 when no tier crossing (GREATEST is a no-op)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE subscriptions
  SET    max_overage_blocks = GREATEST(max_overage_blocks, p_blocks),
         updated_at         = now()
  WHERE  trainer_id = p_trainer_id
    AND  NOT is_ambassador;

  UPDATE clients
  SET    active = true
  WHERE  id          = p_client_id
    AND  trainer_id  = p_trainer_id;
END;
$$;

-- 3b. Atomic INSERT of a new active client + peak update.
--     Used by create-client for brand-new relationships (not reactivations).
--     All nullable measurement fields are accepted so the caller never needs
--     a separate INSERT followed by an UPDATE.
CREATE OR REPLACE FUNCTION insert_client_with_overage_peak(
  p_trainer_id    UUID,
  p_user_id       UUID,
  p_goal          TEXT,
  p_date_of_birth DATE,
  p_weight        NUMERIC,
  p_height        NUMERIC,
  p_gender        TEXT,
  p_notes         TEXT,
  p_activity_level TEXT,
  p_blocks        INT      -- pass 0 when no tier crossing
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  UPDATE subscriptions
  SET    max_overage_blocks = GREATEST(max_overage_blocks, p_blocks),
         updated_at         = now()
  WHERE  trainer_id = p_trainer_id
    AND  NOT is_ambassador;

  INSERT INTO clients (
    trainer_id, user_id,
    goal, date_of_birth, weight, height, gender, notes, activity_level
  ) VALUES (
    p_trainer_id, p_user_id,
    p_goal, p_date_of_birth, p_weight, p_height, p_gender, p_notes, p_activity_level
  )
  RETURNING id INTO v_client_id;

  RETURN v_client_id;
END;
$$;
