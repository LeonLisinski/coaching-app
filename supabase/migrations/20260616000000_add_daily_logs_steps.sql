-- Add daily step tracking to daily_logs.
-- step_goal (target) already lives on clients.step_goal; this stores the achieved
-- daily count synced from HealthKit (iOS) / Health Connect (Android) or entered manually.
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS steps integer
    CONSTRAINT daily_logs_steps_nonneg CHECK (steps IS NULL OR steps >= 0),
  ADD COLUMN IF NOT EXISTS steps_source text
    CONSTRAINT daily_logs_steps_source_check
    CHECK (steps_source IS NULL OR steps_source IN ('healthkit', 'health_connect', 'pedometer', 'manual'));

COMMENT ON COLUMN public.daily_logs.steps IS 'Daily step count for the client (from HealthKit / Health Connect / manual entry).';
COMMENT ON COLUMN public.daily_logs.steps_source IS 'Origin of the steps value: healthkit, health_connect, pedometer, or manual.';
