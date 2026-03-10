-- Add exercise_type column to exercises table
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS exercise_type text NOT NULL DEFAULT 'strength'
    CHECK (exercise_type IN ('strength', 'endurance'));
