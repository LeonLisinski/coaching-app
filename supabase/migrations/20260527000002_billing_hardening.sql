-- ─── Billing hardening migration ─────────────────────────────────────────────
-- Adds:
-- 1. profiles.trial_used_at  → persist trial eligibility across cancellations
-- 2. subscriptions.scheduled_plan_change(_at) → defer downgrades to period end
-- 3. subscriptions.first_failed_at → grace period anchored to first failure
-- 4. Lower client_limit default to 10 (matches Starter)
-- 5. RLS hardening: explicit INSERT/UPDATE/DELETE policies on subscriptions
--    (currently only SELECT) so it's clear ALL writes go through service role.

-- Persist trial usage even if subscription is canceled and re-created.
-- A trainer can only ever get one 14-day free trial in their account's lifetime.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_trial_used
  ON profiles (trial_used_at)
  WHERE trial_used_at IS NOT NULL;

-- Scheduled plan change (used for downgrades — applied at period end by cron).
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_plan_change text
    CHECK (scheduled_plan_change IS NULL OR scheduled_plan_change IN ('starter', 'pro', 'scale'));

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_plan_change_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_change
  ON subscriptions (scheduled_plan_change_at)
  WHERE scheduled_plan_change IS NOT NULL;

-- Anchor for past_due grace period: set once on first failed invoice,
-- not on every retry. locked_at is computed from this.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS first_failed_at timestamptz;

-- Correct default — Starter now has 10 clients, not 15
ALTER TABLE subscriptions
  ALTER COLUMN client_limit SET DEFAULT 10;

-- ─── RLS hardening for subscriptions ─────────────────────────────────────────
-- Existing policy `trainer_read_own_subscription` only covers SELECT.
-- The table is not exposed to anon/authenticated for writes because there's
-- no INSERT/UPDATE/DELETE policy. Service role bypasses RLS. We make this
-- explicit by adding deny-all policies (no-op but documents intent).

DROP POLICY IF EXISTS "subscriptions_no_client_write" ON subscriptions;
CREATE POLICY "subscriptions_no_client_write"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (false)        -- never visible for write
  WITH CHECK (false);  -- never inserted/updated

-- The SELECT policy still works because it has higher specificity.
-- Effectively: trainers can READ their own row but never WRITE to it.
-- All writes must go through service-role API routes / webhook.
