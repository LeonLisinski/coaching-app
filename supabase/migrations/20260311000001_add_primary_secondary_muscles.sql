-- Add primary and secondary muscle groups to exercises table
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS primary_muscles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_muscles text[] NOT NULL DEFAULT '{}';
