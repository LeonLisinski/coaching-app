-- =============================================================================
-- Missing FK indexes — all foreign-key columns that had no supporting index.
-- Verified from live DB 2026-06-05 via pg_indexes + information_schema.
-- Covers 37 FK columns across 21 tables.
-- Uses CREATE INDEX IF NOT EXISTS (idempotent, safe to re-run).
-- =============================================================================

-- admin_task_reminders
CREATE INDEX IF NOT EXISTS idx_admin_task_reminders_task
  ON public.admin_task_reminders (task_id);

-- checkin_config
CREATE INDEX IF NOT EXISTS idx_checkin_config_trainer
  ON public.checkin_config (trainer_id);

-- checkin_parameters
CREATE INDEX IF NOT EXISTS idx_checkin_parameters_trainer
  ON public.checkin_parameters (trainer_id);

-- checkin_templates
CREATE INDEX IF NOT EXISTS idx_checkin_templates_trainer
  ON public.checkin_templates (trainer_id);
CREATE INDEX IF NOT EXISTS idx_checkin_templates_client
  ON public.checkin_templates (client_id);

-- checkins
CREATE INDEX IF NOT EXISTS idx_checkins_trainer
  ON public.checkins (trainer_id);
CREATE INDEX IF NOT EXISTS idx_checkins_client
  ON public.checkins (client_id);

-- client_meal_plans
CREATE INDEX IF NOT EXISTS idx_client_meal_plans_trainer
  ON public.client_meal_plans (trainer_id);
CREATE INDEX IF NOT EXISTS idx_client_meal_plans_client
  ON public.client_meal_plans (client_id);
CREATE INDEX IF NOT EXISTS idx_client_meal_plans_meal_plan
  ON public.client_meal_plans (meal_plan_id);

-- client_packages.trainer_id (client_id + package_id already indexed)
CREATE INDEX IF NOT EXISTS idx_client_packages_trainer
  ON public.client_packages (trainer_id);

-- client_tracked_checkin_parameters
CREATE INDEX IF NOT EXISTS idx_client_tracked_checkin_params_param
  ON public.client_tracked_checkin_parameters (parameter_id);

-- client_tracked_exercises
CREATE INDEX IF NOT EXISTS idx_client_tracked_exercises_exercise
  ON public.client_tracked_exercises (exercise_id);

-- client_weekly_reports
CREATE INDEX IF NOT EXISTS idx_client_weekly_reports_client
  ON public.client_weekly_reports (client_id);

-- client_workout_plans
CREATE INDEX IF NOT EXISTS idx_client_workout_plans_trainer
  ON public.client_workout_plans (trainer_id);
CREATE INDEX IF NOT EXISTS idx_client_workout_plans_client
  ON public.client_workout_plans (client_id);
CREATE INDEX IF NOT EXISTS idx_client_workout_plans_plan
  ON public.client_workout_plans (workout_plan_id);

-- clients.trainer_id (covered by clients_trainer_active but only for active=true;
--                     a plain trainer_id index is needed for inactive client scans)
CREATE INDEX IF NOT EXISTS idx_clients_trainer
  ON public.clients (trainer_id);

-- daily_logs.client_id (trainer_id already indexed)
CREATE INDEX IF NOT EXISTS idx_daily_logs_client
  ON public.daily_logs (client_id);

-- lead_form_questions
CREATE INDEX IF NOT EXISTS idx_lead_form_questions_form
  ON public.lead_form_questions (form_id);

-- lead_submissions
CREATE INDEX IF NOT EXISTS idx_lead_submissions_form
  ON public.lead_submissions (form_id);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_trainer
  ON public.lead_submissions (trainer_id);

-- meals
CREATE INDEX IF NOT EXISTS idx_meals_plan
  ON public.meals (plan_id);

-- messages.trainer_id + client_id
-- (conversation composite index exists; bare FK indexes improve FK-check + individual filters)
CREATE INDEX IF NOT EXISTS idx_messages_trainer
  ON public.messages (trainer_id);
CREATE INDEX IF NOT EXISTS idx_messages_client
  ON public.messages (client_id);

-- nutrition_logs.client_id (trainer_id already indexed)
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_client
  ON public.nutrition_logs (client_id);

-- payments.trainer_id (client_id already indexed)
CREATE INDEX IF NOT EXISTS idx_payments_trainer
  ON public.payments (trainer_id);

-- trainer_events
CREATE INDEX IF NOT EXISTS idx_trainer_events_trainer
  ON public.trainer_events (trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_events_client
  ON public.trainer_events (client_id);
CREATE INDEX IF NOT EXISTS idx_trainer_events_lead_submission
  ON public.trainer_events (lead_submission_id)
  WHERE lead_submission_id IS NOT NULL;

-- trainer_notification_prefs
CREATE INDEX IF NOT EXISTS idx_trainer_notification_prefs_trainer
  ON public.trainer_notification_prefs (trainer_id);

-- trainer_notifications
CREATE INDEX IF NOT EXISTS idx_trainer_notifications_trainer
  ON public.trainer_notifications (trainer_id);

-- trainer_overrides.replacement_id (trainer_id composite already indexed)
CREATE INDEX IF NOT EXISTS idx_trainer_overrides_replacement
  ON public.trainer_overrides (replacement_id);

-- workout_logs.trainer_id + client_id (client_date + plan composite exist)
CREATE INDEX IF NOT EXISTS idx_workout_logs_trainer
  ON public.workout_logs (trainer_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_client
  ON public.workout_logs (client_id);

-- workout_plans
CREATE INDEX IF NOT EXISTS idx_workout_plans_trainer
  ON public.workout_plans (trainer_id);

-- workout_templates
CREATE INDEX IF NOT EXISTS idx_workout_templates_trainer
  ON public.workout_templates (trainer_id);
