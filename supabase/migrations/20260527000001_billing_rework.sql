-- ─── Billing Rework: ambassador plan + new client limits ─────────────────────
-- 1. Add 'ambassador' to the plan CHECK constraint
-- 2. Add is_ambassador boolean flag (for fast access bypasses)
-- 3. Lower client_limit defaults to match new plan structure (10/30/75)
-- 4. Migrate all existing trainers to ambassador plan

-- Drop old CHECK constraint on subscriptions.plan
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Re-add with ambassador included
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('ambassador', 'starter', 'pro', 'scale'));

-- Add is_ambassador flag (safe if already exists)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS is_ambassador boolean NOT NULL DEFAULT false;

-- Allow NULL client_limit for ambassador plan (unlimited)
ALTER TABLE subscriptions
  ALTER COLUMN client_limit DROP NOT NULL;

-- Index for fast ambassador lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_ambassador
  ON subscriptions (is_ambassador)
  WHERE is_ambassador = true;

-- ─── Migrate all existing trainers to Ambassador ──────────────────────────────
-- All existing accounts are test/internal users; give them free permanent access.
UPDATE subscriptions SET
  plan             = 'ambassador',
  is_ambassador    = true,
  status           = 'active',
  client_limit     = NULL,
  cancel_at_period_end = false,
  locked_at        = NULL,
  updated_at       = now()
WHERE is_ambassador = false;

-- For trainers who have a profile but no subscriptions row yet, insert one.
INSERT INTO subscriptions (trainer_id, stripe_customer_id, stripe_subscription_id, plan, is_ambassador, status, client_limit, created_at, updated_at)
SELECT
  p.id,
  'ambassador_' || p.id,  -- placeholder, not a real Stripe ID
  'ambassador_' || p.id,
  'ambassador',
  true,
  'active',
  NULL,
  now(),
  now()
FROM profiles p
WHERE p.role = 'trainer'
  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.trainer_id = p.id)
ON CONFLICT DO NOTHING;

-- ─── Update stripe_subscription_id unique constraint ─────────────────────────
-- The placeholder ambassador IDs above might collide with the unique constraint.
-- Make the constraint conditional (only enforce for non-ambassador plans).
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_stripe_subscription_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id_unique
  ON subscriptions (stripe_subscription_id)
  WHERE is_ambassador = false;
