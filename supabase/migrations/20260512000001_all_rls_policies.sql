-- =============================================================================
-- Complete RLS policy snapshot — exported from live DB 2026-05-12
-- =============================================================================
-- This file is the canonical source of truth for ALL Row Level Security
-- policies in the public schema. It runs after earlier partial migrations
-- and uses DROP … IF EXISTS + CREATE so it is fully idempotent.
--
-- General security model:
--   • Trainers  → access rows where trainer_id = auth.uid()
--   • Clients   → access their own rows via clients.user_id = auth.uid()
--   • Service role → bypasses RLS entirely (used in edge functions & API routes)
--   • anon role  → REVOKED on all data tables (see 20260429000001)
-- =============================================================================

-- ── Enable RLS on every table (idempotent) ───────────────────────────────────
ALTER TABLE public.admin_notes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tasks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_vault                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_log                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_config                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_parameters              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_templates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_meal_plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_packages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tracked_checkin_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tracked_exercises        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_workout_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expo_push_tokens                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailer_campaigns                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_sent                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_overrides               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checkins                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates               ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- profiles
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Trainers can view client profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clients can view trainer profile"  ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trainers can see their own profile AND all clients' profiles
CREATE POLICY "Trainers can view client profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR id IN (
      SELECT user_id FROM public.clients WHERE trainer_id = auth.uid()
    )
  );

-- Clients can see their trainer's profile
CREATE POLICY "Clients can view trainer profile"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT trainer_id FROM public.clients WHERE user_id = auth.uid()
    )
  );


-- =============================================================================
-- trainer_profiles
-- =============================================================================
DROP POLICY IF EXISTS "trainer_profiles_all" ON public.trainer_profiles;

CREATE POLICY "trainer_profiles_all"
  ON public.trainer_profiles FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- =============================================================================
-- subscriptions  (trainers read their own Stripe subscription)
-- =============================================================================
DROP POLICY IF EXISTS "trainer_read_own_subscription" ON public.subscriptions;

CREATE POLICY "trainer_read_own_subscription"
  ON public.subscriptions FOR SELECT
  USING (trainer_id = auth.uid());


-- =============================================================================
-- clients
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage own clients" ON public.clients;
DROP POLICY IF EXISTS "Clients view own record"     ON public.clients;
DROP POLICY IF EXISTS "Clients delete own record"   ON public.clients;

CREATE POLICY "Trainers manage own clients"
  ON public.clients FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Clients view own record"
  ON public.clients FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Clients delete own record"
  ON public.clients FOR DELETE
  USING (user_id = auth.uid());


-- =============================================================================
-- exercises  (trainer-owned; clients can read their trainer's exercises + defaults)
-- =============================================================================
DROP POLICY IF EXISTS "exercises_select"      ON public.exercises;
DROP POLICY IF EXISTS "exercises_insert"      ON public.exercises;
DROP POLICY IF EXISTS "exercises_update"      ON public.exercises;
DROP POLICY IF EXISTS "exercises_delete"      ON public.exercises;
DROP POLICY IF EXISTS "client_read_exercises" ON public.exercises;

CREATE POLICY "exercises_select"
  ON public.exercises FOR SELECT
  TO authenticated
  USING ((trainer_id = auth.uid()) OR (is_default = true));

CREATE POLICY "exercises_insert"
  ON public.exercises FOR INSERT
  TO authenticated
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "exercises_update"
  ON public.exercises FOR UPDATE
  TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "exercises_delete"
  ON public.exercises FOR DELETE
  TO authenticated
  USING (trainer_id = auth.uid());

-- Clients can read exercises that belong to their trainer
CREATE POLICY "client_read_exercises"
  ON public.exercises FOR SELECT
  USING (
    trainer_id IN (
      SELECT trainer_id FROM public.clients WHERE user_id = auth.uid()
    )
  );


-- =============================================================================
-- workout_templates
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage own templates" ON public.workout_templates;

CREATE POLICY "Trainers manage own templates"
  ON public.workout_templates FOR ALL
  USING (trainer_id = auth.uid());


-- =============================================================================
-- workout_plans
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage own workout plans"     ON public.workout_plans;
DROP POLICY IF EXISTS "Clients read assigned workout plans"   ON public.workout_plans;
DROP POLICY IF EXISTS "client_read_assigned_workout_plan"     ON public.workout_plans;

CREATE POLICY "Trainers manage own workout plans"
  ON public.workout_plans FOR ALL
  USING (trainer_id = auth.uid());

-- Legacy client policy (IN subquery)
CREATE POLICY "Clients read assigned workout plans"
  ON public.workout_plans FOR SELECT
  USING (
    id IN (
      SELECT workout_plan_id FROM public.client_workout_plans
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      )
    )
  );

-- Preferred client policy (EXISTS, active plans only)
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


-- =============================================================================
-- client_workout_plans
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage client workout plans" ON public.client_workout_plans;
DROP POLICY IF EXISTS "Clients read own workout plans"       ON public.client_workout_plans;
DROP POLICY IF EXISTS "client_read_own_workout_plans"        ON public.client_workout_plans;

CREATE POLICY "Trainers manage client workout plans"
  ON public.client_workout_plans FOR ALL
  USING (trainer_id = auth.uid());

-- Legacy client policy
CREATE POLICY "Clients read own workout plans"
  ON public.client_workout_plans FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- Preferred client policy (EXISTS)
CREATE POLICY "client_read_own_workout_plans"
  ON public.client_workout_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_workout_plans.client_id
        AND c.user_id = auth.uid()
    )
  );


-- =============================================================================
-- workout_sessions
-- =============================================================================
DROP POLICY IF EXISTS "Clients read own workout sessions"  ON public.workout_sessions;
DROP POLICY IF EXISTS "client_read_own_workout_sessions"   ON public.workout_sessions;

-- Legacy policy
CREATE POLICY "Clients read own workout sessions"
  ON public.workout_sessions FOR SELECT
  USING (
    plan_id IN (
      SELECT workout_plan_id FROM public.client_workout_plans
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      )
    )
  );

-- Preferred policy (EXISTS, active plans only)
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


-- =============================================================================
-- workout_logs
-- =============================================================================
DROP POLICY IF EXISTS "Clients and trainers access workout logs" ON public.workout_logs;
DROP POLICY IF EXISTS "client_read_own_workout_logs"             ON public.workout_logs;

CREATE POLICY "Clients and trainers access workout logs"
  ON public.workout_logs FOR ALL
  USING (
    (trainer_id = auth.uid())
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "client_read_own_workout_logs"
  ON public.workout_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = workout_logs.client_id
        AND c.user_id = auth.uid()
    )
  );


-- =============================================================================
-- foods  (trainer-owned + shared defaults; clients read via is_default or trainer)
-- =============================================================================
DROP POLICY IF EXISTS "foods_select" ON public.foods;
DROP POLICY IF EXISTS "foods_insert" ON public.foods;
DROP POLICY IF EXISTS "foods_update" ON public.foods;
DROP POLICY IF EXISTS "foods_delete" ON public.foods;

CREATE POLICY "foods_select"
  ON public.foods FOR SELECT
  TO authenticated
  USING ((trainer_id = auth.uid()) OR (is_default = true));

CREATE POLICY "foods_insert"
  ON public.foods FOR INSERT
  TO authenticated
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "foods_update"
  ON public.foods FOR UPDATE
  TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "foods_delete"
  ON public.foods FOR DELETE
  TO authenticated
  USING (trainer_id = auth.uid());


-- =============================================================================
-- recipes
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage own recipes"     ON public.recipes;
DROP POLICY IF EXISTS "Clients read assigned recipes"   ON public.recipes;

CREATE POLICY "Trainers manage own recipes"
  ON public.recipes FOR ALL
  USING (trainer_id = auth.uid());

-- Clients can read recipes referenced inside their assigned meal plans
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
          SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
      )
    )
  );


-- =============================================================================
-- meal_plans
-- =============================================================================
DROP POLICY IF EXISTS "Access meal plans"              ON public.meal_plans;
DROP POLICY IF EXISTS "client_read_assigned_meal_plan" ON public.meal_plans;

CREATE POLICY "Access meal plans"
  ON public.meal_plans FOR ALL
  USING (
    (trainer_id = auth.uid())
    OR id IN (
      SELECT meal_plan_id FROM public.client_meal_plans
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
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
        AND c.user_id = auth.uid()
        AND cmp.active = true
    )
  );


-- =============================================================================
-- meals
-- =============================================================================
DROP POLICY IF EXISTS "Access meals"              ON public.meals;
DROP POLICY IF EXISTS "client_read_assigned_meals" ON public.meals;

CREATE POLICY "Access meals"
  ON public.meals FOR ALL
  USING (
    plan_id IN (
      SELECT id FROM public.meal_plans
      WHERE (trainer_id = auth.uid())
        OR id IN (
          SELECT meal_plan_id FROM public.client_meal_plans
          WHERE client_id IN (
            SELECT id FROM public.clients WHERE user_id = auth.uid()
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
        AND c.user_id = auth.uid()
        AND cmp.active = true
    )
  );


-- =============================================================================
-- client_meal_plans
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage client meal plans" ON public.client_meal_plans;
DROP POLICY IF EXISTS "Clients read own meal plans"       ON public.client_meal_plans;
DROP POLICY IF EXISTS "client_read_own_meal_plans"        ON public.client_meal_plans;

CREATE POLICY "Trainers manage client meal plans"
  ON public.client_meal_plans FOR ALL
  USING (trainer_id = auth.uid());

-- Legacy policy
CREATE POLICY "Clients read own meal plans"
  ON public.client_meal_plans FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- Preferred policy (EXISTS)
CREATE POLICY "client_read_own_meal_plans"
  ON public.client_meal_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_meal_plans.client_id
        AND c.user_id = auth.uid()
    )
  );


-- =============================================================================
-- nutrition_logs
-- =============================================================================
DROP POLICY IF EXISTS "Clients and trainers access nutrition logs" ON public.nutrition_logs;
DROP POLICY IF EXISTS "client_rw_own_nutrition_logs"               ON public.nutrition_logs;

CREATE POLICY "Clients and trainers access nutrition logs"
  ON public.nutrition_logs FOR ALL
  USING (
    (trainer_id = auth.uid())
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

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


-- =============================================================================
-- daily_logs
-- =============================================================================
DROP POLICY IF EXISTS "Clients and trainers access daily logs" ON public.daily_logs;
DROP POLICY IF EXISTS "Trainers read client daily logs"        ON public.daily_logs;

CREATE POLICY "Clients and trainers access daily logs"
  ON public.daily_logs FOR ALL
  USING (
    (trainer_id = auth.uid())
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trainers read client daily logs"
  ON public.daily_logs FOR SELECT
  USING (trainer_id = auth.uid());


-- =============================================================================
-- checkins
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage own checkins" ON public.checkins;
DROP POLICY IF EXISTS "Clients manage own checkins"  ON public.checkins;

CREATE POLICY "Trainers manage own checkins"
  ON public.checkins FOR ALL
  USING (trainer_id = auth.uid());

CREATE POLICY "Clients manage own checkins"
  ON public.checkins FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );


-- =============================================================================
-- checkin_config
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage own checkin config"  ON public.checkin_config;
DROP POLICY IF EXISTS "Clients read own checkin config"     ON public.checkin_config;

CREATE POLICY "Trainers manage own checkin config"
  ON public.checkin_config FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Clients read own checkin config"
  ON public.checkin_config FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );


-- =============================================================================
-- checkin_parameters
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage own checkin parameters" ON public.checkin_parameters;
DROP POLICY IF EXISTS "Clients read checkin parameters"        ON public.checkin_parameters;

CREATE POLICY "Trainers manage own checkin parameters"
  ON public.checkin_parameters FOR ALL
  USING (trainer_id = auth.uid());

CREATE POLICY "Clients read checkin parameters"
  ON public.checkin_parameters FOR SELECT
  USING (
    trainer_id IN (
      SELECT trainer_id FROM public.clients WHERE user_id = auth.uid()
    )
  );


-- =============================================================================
-- checkin_templates
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage checkin templates" ON public.checkin_templates;

CREATE POLICY "Trainers manage checkin templates"
  ON public.checkin_templates FOR ALL
  USING (
    (trainer_id = auth.uid())
    OR client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );


-- =============================================================================
-- daily_checkins
-- =============================================================================
DROP POLICY IF EXISTS "Access daily checkins" ON public.daily_checkins;

CREATE POLICY "Access daily checkins"
  ON public.daily_checkins FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE trainer_id = auth.uid() OR user_id = auth.uid()
    )
  );


-- =============================================================================
-- weekly_checkins
-- =============================================================================
DROP POLICY IF EXISTS "Access weekly checkins" ON public.weekly_checkins;

CREATE POLICY "Access weekly checkins"
  ON public.weekly_checkins FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE trainer_id = auth.uid() OR user_id = auth.uid()
    )
  );


-- =============================================================================
-- client_tracked_exercises
-- =============================================================================
DROP POLICY IF EXISTS "trainer_full_access_tracked_exercises" ON public.client_tracked_exercises;
DROP POLICY IF EXISTS "client_read_own_tracked_exercises"     ON public.client_tracked_exercises;

CREATE POLICY "trainer_full_access_tracked_exercises"
  ON public.client_tracked_exercises FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_exercises.client_id
        AND c.trainer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_exercises.client_id
        AND c.trainer_id = auth.uid()
    )
  );

CREATE POLICY "client_read_own_tracked_exercises"
  ON public.client_tracked_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_exercises.client_id
        AND c.user_id = auth.uid()
    )
  );


-- =============================================================================
-- client_tracked_checkin_parameters
-- =============================================================================
DROP POLICY IF EXISTS "trainer_full_access_tracked_checkin_params" ON public.client_tracked_checkin_parameters;
DROP POLICY IF EXISTS "client_read_own_tracked_checkin_params"      ON public.client_tracked_checkin_parameters;

CREATE POLICY "trainer_full_access_tracked_checkin_params"
  ON public.client_tracked_checkin_parameters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_checkin_parameters.client_id
        AND c.trainer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_checkin_parameters.client_id
        AND c.trainer_id = auth.uid()
    )
  );

CREATE POLICY "client_read_own_tracked_checkin_params"
  ON public.client_tracked_checkin_parameters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_checkin_parameters.client_id
        AND c.user_id = auth.uid()
    )
  );


-- =============================================================================
-- packages
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage own packages"    ON public.packages;
DROP POLICY IF EXISTS "client_read_own_package_details" ON public.packages;

CREATE POLICY "Trainers manage own packages"
  ON public.packages FOR ALL
  USING (trainer_id = auth.uid());

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


-- =============================================================================
-- client_packages
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage client packages" ON public.client_packages;
DROP POLICY IF EXISTS "Clients can view own packages"   ON public.client_packages;
DROP POLICY IF EXISTS "client_read_own_packages"        ON public.client_packages;

CREATE POLICY "Trainers manage client packages"
  ON public.client_packages FOR ALL
  USING (trainer_id = auth.uid());

-- Legacy policy
CREATE POLICY "Clients can view own packages"
  ON public.client_packages FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- Preferred policy (EXISTS)
CREATE POLICY "client_read_own_packages"
  ON public.client_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_packages.client_id
        AND c.user_id = auth.uid()
    )
  );


-- =============================================================================
-- payments
-- =============================================================================
DROP POLICY IF EXISTS "Trainers manage payments"   ON public.payments;
DROP POLICY IF EXISTS "client_read_own_payments"   ON public.payments;

CREATE POLICY "Trainers manage payments"
  ON public.payments FOR ALL
  USING (trainer_id = auth.uid());

CREATE POLICY "client_read_own_payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = payments.client_id
        AND c.user_id = auth.uid()
    )
  );


-- =============================================================================
-- messages
-- =============================================================================
DROP POLICY IF EXISTS "Access messages"             ON public.messages;
DROP POLICY IF EXISTS "Clients access own messages" ON public.messages;
DROP POLICY IF EXISTS "Trainers manage own messages" ON public.messages;

-- Legacy broad policy (sender or receiver)
CREATE POLICY "Access messages"
  ON public.messages FOR ALL
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Clients access messages for their client record
CREATE POLICY "Clients access own messages"
  ON public.messages FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- Trainers access their messages (own or sent)
CREATE POLICY "Trainers manage own messages"
  ON public.messages FOR ALL
  USING (trainer_id = auth.uid() OR sender_id = auth.uid());


-- =============================================================================
-- push_subscriptions  (web push for trainers)
-- =============================================================================
DROP POLICY IF EXISTS "Trainer manages own subscriptions" ON public.push_subscriptions;

CREATE POLICY "Trainer manages own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = trainer_id);


-- =============================================================================
-- expo_push_tokens  (mobile push for clients)
-- =============================================================================
DROP POLICY IF EXISTS "Clients manage own push token"  ON public.expo_push_tokens;
DROP POLICY IF EXISTS "Client can upsert own token"    ON public.expo_push_tokens;

CREATE POLICY "Clients manage own push token"
  ON public.expo_push_tokens FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Client can upsert own token"
  ON public.expo_push_tokens FOR ALL
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );


-- =============================================================================
-- trainer_overrides
-- =============================================================================
DROP POLICY IF EXISTS "trainer_overrides_all" ON public.trainer_overrides;

CREATE POLICY "trainer_overrides_all"
  ON public.trainer_overrides FOR ALL
  TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());


-- =============================================================================
-- reminder_sent  (service role only — no authenticated/anon policies)
-- Locked down: only service role (edge functions, API routes) can read/write.
-- =============================================================================
-- No policies needed — RLS enabled with no permissive policies = deny all
-- except service role (which bypasses RLS).


-- =============================================================================
-- processed_webhook_events  (service role only)
-- =============================================================================
DROP POLICY IF EXISTS "service role only" ON public.processed_webhook_events;

CREATE POLICY "service role only"
  ON public.processed_webhook_events FOR ALL
  USING (false);


-- =============================================================================
-- admin_vault  (service role only)
-- =============================================================================
DROP POLICY IF EXISTS "Service role only"          ON public.admin_vault;
DROP POLICY IF EXISTS "Admin full access to vault" ON public.admin_vault;

CREATE POLICY "Service role only"
  ON public.admin_vault FOR ALL
  USING (false)
  WITH CHECK (false);


-- =============================================================================
-- admin_notes, admin_tasks, bug_log, mailer_campaigns
-- All admin-only tables: deny all authenticated/anon; service role bypasses RLS.
-- =============================================================================
DROP POLICY IF EXISTS "admin_access_admin_notes"      ON public.admin_notes;
DROP POLICY IF EXISTS "admin_access_admin_tasks"      ON public.admin_tasks;
DROP POLICY IF EXISTS "admin_access_bug_log"          ON public.bug_log;
DROP POLICY IF EXISTS "admin_access_mailer_campaigns" ON public.mailer_campaigns;

CREATE POLICY "admin_access_admin_notes"
  ON public.admin_notes FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "admin_access_admin_tasks"
  ON public.admin_tasks FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "admin_access_bug_log"
  ON public.bug_log FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "admin_access_mailer_campaigns"
  ON public.mailer_campaigns FOR ALL
  USING (false)
  WITH CHECK (false);
