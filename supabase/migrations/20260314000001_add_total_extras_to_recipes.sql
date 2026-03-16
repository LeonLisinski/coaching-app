ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS total_extras jsonb DEFAULT '{}';
