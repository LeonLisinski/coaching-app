-- =============================================================================
-- RLS performance fix: replace auth.uid() with (select auth.uid())
-- in all USING / WITH CHECK clauses across every table in the public schema.
--
-- Root cause: bare auth.uid() is evaluated once PER ROW during table scans.
-- Wrapping it in a subquery — (select auth.uid()) — forces the planner to
-- evaluate it once PER QUERY and cache the result, giving a dramatic speedup
-- on large tables (e.g., 50 000+ rows).
--
-- Additionally consolidates the 3 overlapping ALL policies on the messages
-- table into 2 clean policies:
--   • "Trainers manage own messages"  — trainer_id = (select auth.uid())
--   • "Clients access own messages"   — client_id via clients.user_id lookup
-- The legacy "Access messages" policy (sender_id / receiver_id columns) is
-- removed; those columns are no longer the canonical access path.
-- =============================================================================

-- ── profiles ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Trainers can view client profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clients can view trainer profile"  ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Trainers can view client profiles"
  ON public.profiles FOR SELECT
  USING (
    (select auth.uid()) = id
    OR id IN (
      SELECT user_id FROM public.clients WHERE trainer_id = (select auth.uid())
    )
  );

CREATE POLICY "Clients can view trainer profile"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT trainer_id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );


-- ── trainer_profiles ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "trainer_profiles_all" ON public.trainer_profiles;

CREATE POLICY "trainer_profiles_all"
  ON public.trainer_profiles FOR ALL
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));


-- ── subscriptions ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "trainer_read_own_subscription" ON public.subscriptions;

CREATE POLICY "trainer_read_own_subscription"
  ON public.subscriptions FOR SELECT
  USING (trainer_id = (select auth.uid()));


-- ── clients ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage own clients" ON public.clients;
DROP POLICY IF EXISTS "Clients view own record"     ON public.clients;
DROP POLICY IF EXISTS "Clients delete own record"   ON public.clients;

CREATE POLICY "Trainers manage own clients"
  ON public.clients FOR ALL
  USING (trainer_id = (select auth.uid()))
  WITH CHECK (trainer_id = (select auth.uid()));

CREATE POLICY "Clients view own record"
  ON public.clients FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY "Clients delete own record"
  ON public.clients FOR DELETE
  USING (user_id = (select auth.uid()));


-- ── exercises ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "exercises_select"      ON public.exercises;
DROP POLICY IF EXISTS "exercises_insert"      ON public.exercises;
DROP POLICY IF EXISTS "exercises_update"      ON public.exercises;
DROP POLICY IF EXISTS "exercises_delete"      ON public.exercises;
DROP POLICY IF EXISTS "client_read_exercises" ON public.exercises;

CREATE POLICY "exercises_select"
  ON public.exercises FOR SELECT
  TO authenticated
  USING ((trainer_id = (select auth.uid())) OR (is_default = true));

CREATE POLICY "exercises_insert"
  ON public.exercises FOR INSERT
  TO authenticated
  WITH CHECK (trainer_id = (select auth.uid()));

CREATE POLICY "exercises_update"
  ON public.exercises FOR UPDATE
  TO authenticated
  USING (trainer_id = (select auth.uid()))
  WITH CHECK (trainer_id = (select auth.uid()));

CREATE POLICY "exercises_delete"
  ON public.exercises FOR DELETE
  TO authenticated
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "client_read_exercises"
  ON public.exercises FOR SELECT
  USING (
    trainer_id IN (
      SELECT trainer_id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );


-- ── workout_templates ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage own templates" ON public.workout_templates;

CREATE POLICY "Trainers manage own templates"
  ON public.workout_templates FOR ALL
  USING (trainer_id = (select auth.uid()));


-- ── workout_plans ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage own workout plans"   ON public.workout_plans;
DROP POLICY IF EXISTS "Clients read assigned workout plans" ON public.workout_plans;
DROP POLICY IF EXISTS "client_read_assigned_workout_plan"   ON public.workout_plans;

CREATE POLICY "Trainers manage own workout plans"
  ON public.workout_plans FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "Clients read assigned workout plans"
  ON public.workout_plans FOR SELECT
  USING (
    id IN (
      SELECT workout_plan_id FROM public.client_workout_plans
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE user_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "client_read_assigned_workout_plan"
  ON public.workout_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_workout_plans cwp
        JOIN public.clients c ON c.id = cwp.client_id
      WHERE cwp.workout_plan_id = workout_plans.id
        AND c.user_id = (select auth.uid())
        AND cwp.active = true
    )
  );


-- ── client_workout_plans ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage client workout plans" ON public.client_workout_plans;
DROP POLICY IF EXISTS "Clients read own workout plans"       ON public.client_workout_plans;
DROP POLICY IF EXISTS "client_read_own_workout_plans"        ON public.client_workout_plans;

CREATE POLICY "Trainers manage client workout plans"
  ON public.client_workout_plans FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "Clients read own workout plans"
  ON public.client_workout_plans FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "client_read_own_workout_plans"
  ON public.client_workout_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_workout_plans.client_id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── workout_sessions ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients read own workout sessions" ON public.workout_sessions;
DROP POLICY IF EXISTS "client_read_own_workout_sessions"  ON public.workout_sessions;

CREATE POLICY "Clients read own workout sessions"
  ON public.workout_sessions FOR SELECT
  USING (
    plan_id IN (
      SELECT workout_plan_id FROM public.client_workout_plans
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE user_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "client_read_own_workout_sessions"
  ON public.workout_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_workout_plans cwp
        JOIN public.clients c ON c.id = cwp.client_id
      WHERE cwp.workout_plan_id = workout_sessions.plan_id
        AND c.user_id = (select auth.uid())
        AND cwp.active = true
    )
  );


-- ── workout_logs ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients and trainers access workout logs" ON public.workout_logs;
DROP POLICY IF EXISTS "client_read_own_workout_logs"             ON public.workout_logs;

CREATE POLICY "Clients and trainers access workout logs"
  ON public.workout_logs FOR ALL
  USING (
    (trainer_id = (select auth.uid()))
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "client_read_own_workout_logs"
  ON public.workout_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = workout_logs.client_id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── foods ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "foods_select" ON public.foods;
DROP POLICY IF EXISTS "foods_insert" ON public.foods;
DROP POLICY IF EXISTS "foods_update" ON public.foods;
DROP POLICY IF EXISTS "foods_delete" ON public.foods;

CREATE POLICY "foods_select"
  ON public.foods FOR SELECT
  TO authenticated
  USING ((trainer_id = (select auth.uid())) OR (is_default = true));

CREATE POLICY "foods_insert"
  ON public.foods FOR INSERT
  TO authenticated
  WITH CHECK (trainer_id = (select auth.uid()));

CREATE POLICY "foods_update"
  ON public.foods FOR UPDATE
  TO authenticated
  USING (trainer_id = (select auth.uid()))
  WITH CHECK (trainer_id = (select auth.uid()));

CREATE POLICY "foods_delete"
  ON public.foods FOR DELETE
  TO authenticated
  USING (trainer_id = (select auth.uid()));


-- ── recipes ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage own recipes"   ON public.recipes;
DROP POLICY IF EXISTS "Clients read assigned recipes" ON public.recipes;

CREATE POLICY "Trainers manage own recipes"
  ON public.recipes FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "Clients read assigned recipes"
  ON public.recipes FOR SELECT
  USING (
    id IN (
      SELECT (meal.value->>'recipe_id')::uuid
      FROM public.meal_plans,
        LATERAL jsonb_array_elements(meal_plans.meals) AS meal(value)
      WHERE meal_plans.id IN (
        SELECT meal_plan_id FROM public.client_meal_plans
        WHERE client_id IN (
          SELECT id FROM public.clients WHERE user_id = (select auth.uid())
        )
      )
    )
  );


-- ── meal_plans ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Access meal plans"              ON public.meal_plans;
DROP POLICY IF EXISTS "client_read_assigned_meal_plan" ON public.meal_plans;

CREATE POLICY "Access meal plans"
  ON public.meal_plans FOR ALL
  USING (
    (trainer_id = (select auth.uid()))
    OR id IN (
      SELECT meal_plan_id FROM public.client_meal_plans
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE user_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "client_read_assigned_meal_plan"
  ON public.meal_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_meal_plans cmp
        JOIN public.clients c ON c.id = cmp.client_id
      WHERE cmp.meal_plan_id = meal_plans.id
        AND c.user_id = (select auth.uid())
        AND cmp.active = true
    )
  );


-- ── meals ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Access meals"               ON public.meals;
DROP POLICY IF EXISTS "client_read_assigned_meals" ON public.meals;

CREATE POLICY "Access meals"
  ON public.meals FOR ALL
  USING (
    plan_id IN (
      SELECT id FROM public.meal_plans
      WHERE (trainer_id = (select auth.uid()))
        OR id IN (
          SELECT meal_plan_id FROM public.client_meal_plans
          WHERE client_id IN (
            SELECT id FROM public.clients WHERE user_id = (select auth.uid())
          )
        )
    )
  );

CREATE POLICY "client_read_assigned_meals"
  ON public.meals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_meal_plans cmp
        JOIN public.clients c ON c.id = cmp.client_id
      WHERE cmp.meal_plan_id = meals.plan_id
        AND c.user_id = (select auth.uid())
        AND cmp.active = true
    )
  );


-- ── client_meal_plans ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage client meal plans" ON public.client_meal_plans;
DROP POLICY IF EXISTS "Clients read own meal plans"       ON public.client_meal_plans;
DROP POLICY IF EXISTS "client_read_own_meal_plans"        ON public.client_meal_plans;

CREATE POLICY "Trainers manage client meal plans"
  ON public.client_meal_plans FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "Clients read own meal plans"
  ON public.client_meal_plans FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "client_read_own_meal_plans"
  ON public.client_meal_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_meal_plans.client_id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── nutrition_logs ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients and trainers access nutrition logs" ON public.nutrition_logs;
DROP POLICY IF EXISTS "client_rw_own_nutrition_logs"               ON public.nutrition_logs;

CREATE POLICY "Clients and trainers access nutrition logs"
  ON public.nutrition_logs FOR ALL
  USING (
    (trainer_id = (select auth.uid()))
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "client_rw_own_nutrition_logs"
  ON public.nutrition_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = nutrition_logs.client_id
        AND c.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = nutrition_logs.client_id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── daily_logs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients and trainers access daily logs" ON public.daily_logs;
DROP POLICY IF EXISTS "Trainers read client daily logs"        ON public.daily_logs;

CREATE POLICY "Clients and trainers access daily logs"
  ON public.daily_logs FOR ALL
  USING (
    (trainer_id = (select auth.uid()))
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Trainers read client daily logs"
  ON public.daily_logs FOR SELECT
  USING (trainer_id = (select auth.uid()));


-- ── checkins ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage own checkins" ON public.checkins;
DROP POLICY IF EXISTS "Clients manage own checkins"  ON public.checkins;

CREATE POLICY "Trainers manage own checkins"
  ON public.checkins FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "Clients manage own checkins"
  ON public.checkins FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );


-- ── checkin_config ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage own checkin config" ON public.checkin_config;
DROP POLICY IF EXISTS "Clients read own checkin config"    ON public.checkin_config;

CREATE POLICY "Trainers manage own checkin config"
  ON public.checkin_config FOR ALL
  USING (trainer_id = (select auth.uid()))
  WITH CHECK (trainer_id = (select auth.uid()));

CREATE POLICY "Clients read own checkin config"
  ON public.checkin_config FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );


-- ── checkin_parameters ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage own checkin parameters" ON public.checkin_parameters;
DROP POLICY IF EXISTS "Clients read checkin parameters"        ON public.checkin_parameters;

CREATE POLICY "Trainers manage own checkin parameters"
  ON public.checkin_parameters FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "Clients read checkin parameters"
  ON public.checkin_parameters FOR SELECT
  USING (
    trainer_id IN (
      SELECT trainer_id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );


-- ── checkin_templates ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage checkin templates" ON public.checkin_templates;

CREATE POLICY "Trainers manage checkin templates"
  ON public.checkin_templates FOR ALL
  USING (
    (trainer_id = (select auth.uid()))
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );


-- ── daily_checkins ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Access daily checkins" ON public.daily_checkins;

CREATE POLICY "Access daily checkins"
  ON public.daily_checkins FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE trainer_id = (select auth.uid()) OR user_id = (select auth.uid())
    )
  );


-- ── weekly_checkins ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Access weekly checkins" ON public.weekly_checkins;

CREATE POLICY "Access weekly checkins"
  ON public.weekly_checkins FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE trainer_id = (select auth.uid()) OR user_id = (select auth.uid())
    )
  );


-- ── client_tracked_exercises ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "trainer_full_access_tracked_exercises" ON public.client_tracked_exercises;
DROP POLICY IF EXISTS "client_read_own_tracked_exercises"     ON public.client_tracked_exercises;

CREATE POLICY "trainer_full_access_tracked_exercises"
  ON public.client_tracked_exercises FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_exercises.client_id
        AND c.trainer_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_exercises.client_id
        AND c.trainer_id = (select auth.uid())
    )
  );

CREATE POLICY "client_read_own_tracked_exercises"
  ON public.client_tracked_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_exercises.client_id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── client_tracked_checkin_parameters ────────────────────────────────────────
DROP POLICY IF EXISTS "trainer_full_access_tracked_checkin_params" ON public.client_tracked_checkin_parameters;
DROP POLICY IF EXISTS "client_read_own_tracked_checkin_params"      ON public.client_tracked_checkin_parameters;

CREATE POLICY "trainer_full_access_tracked_checkin_params"
  ON public.client_tracked_checkin_parameters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_checkin_parameters.client_id
        AND c.trainer_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_checkin_parameters.client_id
        AND c.trainer_id = (select auth.uid())
    )
  );

CREATE POLICY "client_read_own_tracked_checkin_params"
  ON public.client_tracked_checkin_parameters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_checkin_parameters.client_id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── packages ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage own packages"    ON public.packages;
DROP POLICY IF EXISTS "client_read_own_package_details" ON public.packages;

CREATE POLICY "Trainers manage own packages"
  ON public.packages FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "client_read_own_package_details"
  ON public.packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_packages cp
        JOIN public.clients c ON c.id = cp.client_id
      WHERE cp.package_id = packages.id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── client_packages ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage client packages" ON public.client_packages;
DROP POLICY IF EXISTS "Clients can view own packages"   ON public.client_packages;
DROP POLICY IF EXISTS "client_read_own_packages"        ON public.client_packages;

CREATE POLICY "Trainers manage client packages"
  ON public.client_packages FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "Clients can view own packages"
  ON public.client_packages FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "client_read_own_packages"
  ON public.client_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_packages.client_id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── payments ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainers manage payments" ON public.payments;
DROP POLICY IF EXISTS "client_read_own_payments" ON public.payments;

CREATE POLICY "Trainers manage payments"
  ON public.payments FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "client_read_own_payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = payments.client_id
        AND c.user_id = (select auth.uid())
    )
  );


-- ── messages (consolidated: 3 → 2 policies, removed sender_id/receiver_id legacy) ──
DROP POLICY IF EXISTS "Access messages"              ON public.messages;
DROP POLICY IF EXISTS "Clients access own messages"  ON public.messages;
DROP POLICY IF EXISTS "Trainers manage own messages" ON public.messages;

CREATE POLICY "Trainers manage own messages"
  ON public.messages FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "Clients access own messages"
  ON public.messages FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );


-- ── push_subscriptions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Trainer manages own subscriptions" ON public.push_subscriptions;

CREATE POLICY "Trainer manages own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING ((select auth.uid()) = trainer_id);


-- ── expo_push_tokens ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients manage own push token" ON public.expo_push_tokens;
DROP POLICY IF EXISTS "Client can upsert own token"   ON public.expo_push_tokens;

CREATE POLICY "Clients manage own push token"
  ON public.expo_push_tokens FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Client can upsert own token"
  ON public.expo_push_tokens FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = (select auth.uid())
    )
  );


-- ── trainer_overrides ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "trainer_overrides_all" ON public.trainer_overrides;

CREATE POLICY "trainer_overrides_all"
  ON public.trainer_overrides FOR ALL
  TO authenticated
  USING (trainer_id = (select auth.uid()))
  WITH CHECK (trainer_id = (select auth.uid()));
