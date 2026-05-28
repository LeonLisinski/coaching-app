-- ─────────────────────────────────────────────────────────────────────────────
-- Promo period tracking
--
-- Business rules (FINAL):
--   • 50% off for the first 12 consecutive PAID monthly billing periods.
--   • Free trial (14 days) does NOT consume any of the 12 promo months.
--   • Promo right is granted at first qualifying checkout while global promo
--     date (NEXT_PUBLIC_FOUNDING_PROMO_END) is in the future.
--   • Promo is permanently lost on cancellation — even if the date has not
--     expired, re-subscribing never restores promo rights.
--   • Upgrade / downgrade during promo period: discount stays on new base
--     price until original promo_ends_at, never restarted.
--   • Failed payment / grace period / recovery do NOT extend promo_ends_at.
--
-- Fields:
--   promo_granted_at              — when promo right was granted (at checkout).
--                                   NULL = user never received promo.
--   promo_paid_period_started_at  — timestamp of first paid invoice after trial.
--                                   NULL until first real charge succeeds.
--   promo_ends_at                 — promo_paid_period_started_at + 12 months.
--                                   NULL until first paid invoice.
--   promo_lost_at                 — set on subscription cancellation.
--                                   NULL until cancelled.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS promo_granted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS promo_paid_period_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_ends_at                timestamptz,
  ADD COLUMN IF NOT EXISTS promo_lost_at                timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscriptions_promo_ends
  ON subscriptions (promo_ends_at)
  WHERE promo_ends_at IS NOT NULL AND promo_lost_at IS NULL;
