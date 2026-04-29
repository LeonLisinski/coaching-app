-- ─────────────────────────────────────────────────────────────────────────────
-- Client SELECT policies for plan & data tables
-- ─────────────────────────────────────────────────────────────────────────────
-- The mobile app (coaching-app-mobile) authenticates as the CLIENT user.
-- Several tables only had trainer policies (trainer_id = auth.uid()), so
-- the mobile app received 0 rows even when data existed — showing "Nema plana".
--
-- Pattern: client can SELECT rows where their auth.uid() matches the user_id
-- of the clients row linked to this data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── client_workout_plans ─────────────────────────────────────────────────────
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
-- Joined by the mobile app via client_workout_plans(workout_plans(name, days))
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

-- ── meal_plans ────────────────────────────────────────────────────────────────
-- Joined by the mobile app via client_meal_plans(meal_plans(name, ...))
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

-- ── client_packages ───────────────────────────────────────────────────────────
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

-- ── workout_logs ──────────────────────────────────────────────────────────────
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

-- ── workout_sessions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "client_read_own_workout_sessions" ON public.workout_sessions;
CREATE POLICY "client_read_own_workout_sessions"
  ON public.workout_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = workout_sessions.client_id
        AND c.user_id = auth.uid()
    )
  );

-- ── exercises (referenced by workout plan days — mobile needs to read them) ──
DROP POLICY IF EXISTS "client_read_exercises" ON public.exercises;
CREATE POLICY "client_read_exercises"
  ON public.exercises FOR SELECT
  USING (
    -- Any authenticated user can read the exercises catalogue
    auth.role() = 'authenticated'
  );

-- ── meals ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "client_read_assigned_meals" ON public.meals;
CREATE POLICY "client_read_assigned_meals"
  ON public.meals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_meal_plans cmp
        JOIN public.clients c ON c.id = cmp.client_id
      WHERE cmp.meal_plan_id = meals.meal_plan_id
        AND c.user_id = auth.uid()
    )
  );

-- ── recipes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "client_read_assigned_recipes" ON public.recipes;
CREATE POLICY "client_read_assigned_recipes"
  ON public.recipes FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );

-- ── nutrition_logs ────────────────────────────────────────────────────────────
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
