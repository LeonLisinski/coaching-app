-- Add supplements column to client_meal_plans
ALTER TABLE public.client_meal_plans
  ADD COLUMN IF NOT EXISTS supplements jsonb NOT NULL DEFAULT '[]';
