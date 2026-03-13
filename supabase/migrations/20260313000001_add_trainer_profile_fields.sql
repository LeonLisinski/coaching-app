-- Add nutrition and exercise custom field settings to trainer_profiles
ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS nutrition_fields text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS exercise_fields  text[] DEFAULT ARRAY[]::text[];
