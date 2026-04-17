-- Per-assignment period end: set when a plan is deactivated (archived), not when deleted.
-- Web/mobile: workout_logs.plan_id may store workout_plans.id (template) as set by the mobile client; retain assignments when logs exist.

ALTER TABLE public.client_workout_plans
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

COMMENT ON COLUMN public.client_workout_plans.ended_at IS
  'When this assignment stopped being active (plan switch). NULL if currently active or legacy row.';

CREATE INDEX IF NOT EXISTS idx_client_workout_plans_client_active
  ON public.client_workout_plans (client_id, active);
