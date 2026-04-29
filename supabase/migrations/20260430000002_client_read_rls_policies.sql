-- ─────────────────────────────────────────────────────────────────────────────
-- Client SELECT policies for plan & data tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Schema verified 2026-04-29 against live DB.
-- Mobile app authenticates as the CLIENT user (authenticated role, user_id).
-- Tables only had trainer policies → client queries returned 0 rows ("Nema plana").
-- ─────────────────────────────────────────────────────────────────────────────

-- ── client_workout_plans ─────────────────────────────────────────────────────
-- Columns: id, trainer_id, client_id, workout_plan_id, active, ...
DROP POLICY IF EXISTS "client_read_own_workout_plans" ON public.client_workout_plans;
CREATE POLICY "client_read_own_workout_plans"
  ON public.client_workout_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_workout_plans.client_id
        AND c.user_id = auth.uid()
    )
  );

-- ── client_meal_plans ────────────────────────────────────────────────────────
-- Columns: id, trainer_id, client_id, meal_plan_id, active, ...
DROP POLICY IF EXISTS "client_read_own_meal_plans" ON public.client_meal_plans;
CREATE POLICY "client_read_own_meal_plans"
  ON public.client_meal_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_meal_plans.client_id
        AND c.user_id = auth.uid()
    )
  );

-- ── workout_plans ─────────────────────────────────────────────────────────────
-- Joined by mobile via client_workout_plans(workout_plan_id → workout_plans.id)
DROP POLICY IF EXISTS "client_read_assigned_workout_plan" ON public.workout_plans;
CREATE POLICY "client_read_assigned_workout_plan"
  ON public.workout_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_workout_plans cwp
        JOIN public.clients c ON c.id = cwp.client_id
      WHERE cwp.workout_plan_id = workout_plans.id
        AND c.user_id = auth.uid()
        AND cwp.active = true
    )
  );

-- ── workout_sessions ─────────────────────────────────────────────────────────
-- Columns: id, plan_id, day_name, day_order, exercises, created_at
-- plan_id references workout_plans.id
DROP POLICY IF EXISTS "client_read_own_workout_sessions" ON public.workout_sessions;
CREATE POLICY "client_read_own_workout_sessions"
  ON public.workout_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_workout_plans cwp
        JOIN public.clients c ON c.id = cwp.client_id
      WHERE cwp.workout_plan_id = workout_sessions.plan_id
        AND c.user_id = auth.uid()
        AND cwp.active = true
    )
  );

-- ── workout_logs ──────────────────────────────────────────────────────────────
-- Columns: id, client_id, trainer_id, plan_id
DROP POLICY IF EXISTS "client_read_own_workout_logs" ON public.workout_logs;
CREATE POLICY "client_read_own_workout_logs"
  ON public.workout_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = workout_logs.client_id
        AND c.user_id = auth.uid()
    )
  );

-- ── meal_plans ────────────────────────────────────────────────────────────────
-- Columns: id, trainer_id, client_id, name, ...
-- Joined by mobile via client_meal_plans(meal_plan_id → meal_plans.id)
DROP POLICY IF EXISTS "client_read_assigned_meal_plan" ON public.meal_plans;
CREATE POLICY "client_read_assigned_meal_plan"
  ON public.meal_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_meal_plans cmp
        JOIN public.clients c ON c.id = cmp.client_id
      WHERE cmp.meal_plan_id = meal_plans.id
        AND c.user_id = auth.uid()
        AND cmp.active = true
    )
  );

-- ── meals ────────────────────────────────────────────────────────────────────
-- Columns: id, plan_id, meal_type, meal_order, foods, created_at
-- plan_id references meal_plans.id
DROP POLICY IF EXISTS "client_read_assigned_meals" ON public.meals;
CREATE POLICY "client_read_assigned_meals"
  ON public.meals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_meal_plans cmp
        JOIN public.clients c ON c.id = cmp.client_id
      WHERE cmp.meal_plan_id = meals.plan_id
        AND c.user_id = auth.uid()
        AND cmp.active = true
    )
  );

-- ── nutrition_logs ────────────────────────────────────────────────────────────
-- Columns: id, client_id, trainer_id, plan_id, date, ...
DROP POLICY IF EXISTS "client_rw_own_nutrition_logs" ON public.nutrition_logs;
CREATE POLICY "client_rw_own_nutrition_logs"
  ON public.nutrition_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = nutrition_logs.client_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = nutrition_logs.client_id
        AND c.user_id = auth.uid()
    )
  );

-- ── client_packages ───────────────────────────────────────────────────────────
-- Columns: id, trainer_id, client_id, package_id, ...
DROP POLICY IF EXISTS "client_read_own_packages" ON public.client_packages;
CREATE POLICY "client_read_own_packages"
  ON public.client_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_packages.client_id
        AND c.user_id = auth.uid()
    )
  );

-- ── packages ──────────────────────────────────────────────────────────────────
-- Columns: id, trainer_id, name, ... (no client_id — trainer-owned catalogue)
-- Client reads via client_packages.package_id → packages.id
DROP POLICY IF EXISTS "client_read_own_package_details" ON public.packages;
CREATE POLICY "client_read_own_package_details"
  ON public.packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_packages cp
        JOIN public.clients c ON c.id = cp.client_id
      WHERE cp.package_id = packages.id
        AND c.user_id = auth.uid()
    )
  );

-- ── payments ──────────────────────────────────────────────────────────────────
-- Columns: id, trainer_id, client_id, client_package_id, ...
DROP POLICY IF EXISTS "client_read_own_payments" ON public.payments;
CREATE POLICY "client_read_own_payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = payments.client_id
        AND c.user_id = auth.uid()
    )
  );

-- ── exercises ────────────────────────────────────────────────────────────────
-- Shared catalogue — any authenticated user can read
DROP POLICY IF EXISTS "client_read_exercises" ON public.exercises;
CREATE POLICY "client_read_exercises"
  ON public.exercises FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── recipes ──────────────────────────────────────────────────────────────────
-- Columns: id, trainer_id, name, ... (trainer-owned, no client_id)
-- Mobile reads recipes referenced in meal foods JSON — allow any authenticated
DROP POLICY IF EXISTS "client_read_assigned_recipes" ON public.recipes;
CREATE POLICY "client_read_assigned_recipes"
  ON public.recipes FOR SELECT
  USING (auth.role() = 'authenticated');
