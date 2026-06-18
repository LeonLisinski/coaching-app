-- =============================================================
-- Performance indices for exercises, foods, templates, plans, events
-- Added to cover the common OR(trainer_id, is_default) + name
-- query pattern used across training, nutrition, and search pages.
-- =============================================================

-- Cover exercises OR(trainer_id, is_default) + ORDER BY name
CREATE INDEX IF NOT EXISTS idx_exercises_trainer_name
  ON public.exercises (trainer_id, name) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_default_true
  ON public.exercises (name) WHERE is_default = true;

-- Cover foods OR(trainer_id, is_default) + ORDER BY name
CREATE INDEX IF NOT EXISTS idx_foods_trainer_name
  ON public.foods (trainer_id, name) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_foods_default_true
  ON public.foods (name) WHERE is_default = true;

-- Cover templates/plans ORDER BY created_at DESC queries
CREATE INDEX IF NOT EXISTS idx_workout_templates_trainer_created
  ON public.workout_templates (trainer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_plans_trainer_created
  ON public.workout_plans (trainer_id, created_at DESC) WHERE is_template = true;

-- Cover trainer_events range scans (trainer + starts_at range, month navigation)
CREATE INDEX IF NOT EXISTS idx_trainer_events_trainer_starts
  ON public.trainer_events (trainer_id, starts_at DESC);
