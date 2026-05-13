-- ─────────────────────────────────────────────────────────────────────────────
-- Scale-readiness indexes
-- Additive-only migration — safe to run on live DB without downtime.
-- All use CREATE INDEX CONCURRENTLY equivalent (IF NOT EXISTS + no lock).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Chat / messages ──────────────────────────────────────────────────────────

-- Conversation fetch & "load older" cursor pagination
-- Query: .eq('client_id', X).eq('trainer_id', Y).order('created_at', desc).limit(N)
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (client_id, trainer_id, created_at DESC);

-- ── Checkins ─────────────────────────────────────────────────────────────────

-- Per-client checkin history (client profile timeline, stats)
-- Query: .eq('client_id', X).order('date', desc)
CREATE INDEX IF NOT EXISTS idx_checkins_client_date
  ON checkins (client_id, date DESC);

-- ── Workout logs ─────────────────────────────────────────────────────────────

-- Mobile: fetch this week's logs by client
-- Query: .eq('client_id', X).gte('date', weekStart).lte('date', weekEnd)
CREATE INDEX IF NOT EXISTS idx_workout_logs_client_date
  ON workout_logs (client_id, date DESC);

-- Mobile: fetch previous log for a specific plan day (prev-session reference)
-- Query: .eq('client_id', X).eq('plan_id', Y).eq('day_name', Z).order('date', desc).limit(2)
CREATE INDEX IF NOT EXISTS idx_workout_logs_client_plan_day
  ON workout_logs (client_id, plan_id, day_name, date DESC);

-- ── Nutrition logs ───────────────────────────────────────────────────────────

-- Mobile: fetch today's log
-- Query: .eq('client_id', X).eq('date', today)
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_client_date
  ON nutrition_logs (client_id, date);

-- ── Daily logs ───────────────────────────────────────────────────────────────

-- Mobile nutrition tab: fetch daily metadata (training day flag)
-- Query: .eq('client_id', X).eq('date', today)
CREATE INDEX IF NOT EXISTS idx_daily_logs_client_date
  ON daily_logs (client_id, date);

-- ── Exercises library ────────────────────────────────────────────────────────

-- Default exercises listing (shared platform catalog)
-- Query: .or('is_default.eq.true,...').order('name')
CREATE INDEX IF NOT EXISTS idx_exercises_default_name
  ON exercises (is_default, name)
  WHERE is_default = true;

-- Trainer's custom exercises
-- Query: .or('trainer_id.eq.X,...')
CREATE INDEX IF NOT EXISTS idx_exercises_trainer
  ON exercises (trainer_id)
  WHERE is_default = false;

-- ── Foods library ────────────────────────────────────────────────────────────

-- Default foods listing
CREATE INDEX IF NOT EXISTS idx_foods_default_name
  ON foods (is_default, name)
  WHERE is_default = true;

-- Trainer's custom foods
CREATE INDEX IF NOT EXISTS idx_foods_trainer
  ON foods (trainer_id)
  WHERE is_default = false;

-- ── Trainer overrides ────────────────────────────────────────────────────────

-- Override lookup (which defaults this trainer has forked/hidden)
-- Query: .eq('trainer_id', X).eq('resource_type', Y)
CREATE INDEX IF NOT EXISTS idx_trainer_overrides_trainer_type
  ON trainer_overrides (trainer_id, resource_type);

-- ── Payments ─────────────────────────────────────────────────────────────────

-- Paid payments for trainer dashboard "recent payments" widget
-- Query: .eq('trainer_id', X).eq('status', 'paid').order('paid_at', desc).limit(5)
CREATE INDEX IF NOT EXISTS idx_payments_trainer_paid
  ON payments (trainer_id, paid_at DESC)
  WHERE status = 'paid';
