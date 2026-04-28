-- ─────────────────────────────────────────────────────────────────────────────
-- 1. processed_webhook_events table
--    Used for idempotency on Stripe events that send emails
--    (customer.subscription.trial_will_end, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text      NOT NULL UNIQUE,
  event_type    text        NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role only — no client access needed
CREATE POLICY "service role only" ON public.processed_webhook_events
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Performance indexes — composite + partial
-- ─────────────────────────────────────────────────────────────────────────────

-- subscriptions: primary lookup by trainer_id + status (layout checkAccess, middleware)
CREATE INDEX IF NOT EXISTS idx_subscriptions_trainer_status
  ON subscriptions (trainer_id, status);

-- clients: active clients per trainer (create-client limit check, dashboard overview)
CREATE INDEX IF NOT EXISTS idx_clients_trainer_active
  ON clients (trainer_id, active)
  WHERE active = true;

-- messages: unread messages per trainer (notification bell)
CREATE INDEX IF NOT EXISTS idx_messages_trainer_unread
  ON messages (trainer_id, read, created_at DESC)
  WHERE read = false;

-- checkins: date-scoped lookups per trainer (notification bell, cron)
CREATE INDEX IF NOT EXISTS idx_checkins_trainer_date
  ON checkins (trainer_id, date DESC);

-- client_packages: active packages per trainer with end_date (expiry alerts)
CREATE INDEX IF NOT EXISTS idx_client_packages_trainer_status_end
  ON client_packages (trainer_id, status, end_date)
  WHERE status = 'active';

-- payments: pending payments per trainer (weekly digest cron)
CREATE INDEX IF NOT EXISTS idx_payments_trainer_status
  ON payments (trainer_id, status)
  WHERE status = 'pending';
