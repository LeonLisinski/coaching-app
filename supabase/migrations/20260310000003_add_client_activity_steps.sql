-- Add activity_level and step_goal to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS activity_level text
    CONSTRAINT clients_activity_level_check
    CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  ADD COLUMN IF NOT EXISTS step_goal integer;
