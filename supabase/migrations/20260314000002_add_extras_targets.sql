ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS extras_targets jsonb DEFAULT '{}';

ALTER TABLE client_meal_plans
  ADD COLUMN IF NOT EXISTS extras_targets jsonb DEFAULT '{}';
