-- Drop duplicate index on client_meal_plans.
-- Detected in production: client_meal_plans_client_id_active_plan_type_idx and
-- client_meal_plans_client_id_active_plan_type_idx1 cover the same columns.
-- Postgres will only use one — the duplicate just adds write overhead.

DROP INDEX IF EXISTS public.client_meal_plans_client_id_active_plan_type_idx1;
