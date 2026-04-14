-- Add custom_name to client_meal_plans so trainers can rename a client's copy independently
ALTER TABLE client_meal_plans ADD COLUMN IF NOT EXISTS custom_name text;

-- Add workout_defaults to trainer_profiles for per-trainer default exercise parameters
ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS workout_defaults jsonb DEFAULT '{}'::jsonb;
