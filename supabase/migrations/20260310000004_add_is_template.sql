-- Add is_template flag to meal_plans and workout_plans.
-- Plans created from client view (not saved to template library) get is_template = false.
-- Existing plans default to true to preserve current behavior.

ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT true;

ALTER TABLE workout_plans
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT true;
