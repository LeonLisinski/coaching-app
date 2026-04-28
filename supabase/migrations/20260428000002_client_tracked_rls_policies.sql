-- RLS policies for client_tracked_exercises and client_tracked_checkin_parameters.
-- Both tables had RLS enabled but no policies, blocking all access.
--
-- Access model:
--   * Trainer owning the client (clients.trainer_id = auth.uid()) can SELECT/INSERT/UPDATE/DELETE
--   * Client owning the row (clients.user_id = auth.uid()) can SELECT (so mobile app can read the tracked sets)

-- ── client_tracked_exercises ─────────────────────────────────────────────────

ALTER TABLE public.client_tracked_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_full_access_tracked_exercises"
  ON public.client_tracked_exercises;
CREATE POLICY "trainer_full_access_tracked_exercises"
  ON public.client_tracked_exercises
  FOR ALL
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

DROP POLICY IF EXISTS "client_read_own_tracked_exercises"
  ON public.client_tracked_exercises;
CREATE POLICY "client_read_own_tracked_exercises"
  ON public.client_tracked_exercises
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_exercises.client_id
        AND c.user_id = auth.uid()
    )
  );

-- ── client_tracked_checkin_parameters ────────────────────────────────────────

ALTER TABLE public.client_tracked_checkin_parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_full_access_tracked_checkin_params"
  ON public.client_tracked_checkin_parameters;
CREATE POLICY "trainer_full_access_tracked_checkin_params"
  ON public.client_tracked_checkin_parameters
  FOR ALL
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

DROP POLICY IF EXISTS "client_read_own_tracked_checkin_params"
  ON public.client_tracked_checkin_parameters;
CREATE POLICY "client_read_own_tracked_checkin_params"
  ON public.client_tracked_checkin_parameters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tracked_checkin_parameters.client_id
        AND c.user_id = auth.uid()
    )
  );
