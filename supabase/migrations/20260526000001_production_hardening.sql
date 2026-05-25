-- =============================================================================
-- Production hardening migration
-- Additive indexes + security tightening. Safe to run on live DB.
-- =============================================================================

-- 1. trainer_events: lookup by lead_submission_id (used in prijave/saveDetails)
--    Query: .eq('lead_submission_id', subId) — currently a full table scan
CREATE INDEX IF NOT EXISTS trainer_events_lead_submission_id_idx
  ON public.trainer_events (lead_submission_id)
  WHERE lead_submission_id IS NOT NULL;

-- 2. trainer_events: manualDone query (type=checkin, completed=true, per trainer)
--    Query: .eq('trainer_id', uid).eq('type','checkin').eq('completed', true)
CREATE INDEX IF NOT EXISTS trainer_events_checkin_done_idx
  ON public.trainer_events (trainer_id, client_id, starts_at)
  WHERE type = 'checkin' AND completed = true;

-- 3. checkin_config: client_id lookups from calendar + clients page
--    Query: .in('client_id', clientIds)
CREATE INDEX IF NOT EXISTS checkin_config_client_id_idx
  ON public.checkin_config (client_id);

-- 4. lead_submissions: status filtering in prijave dashboard
--    Query: .eq('trainer_id', uid).eq('status', 'new')
CREATE INDEX IF NOT EXISTS lead_submissions_trainer_status_created_idx
  ON public.lead_submissions (trainer_id, status, created_at DESC);

-- 5. SECURITY: Remove unrestricted anon INSERT on lead_submissions.
--    Public intake forms submit via /api/leads/submit (service role + validation).
--    This policy allowed arbitrary spam rows with any trainer_id.
DROP POLICY IF EXISTS "lead_submissions_anon_insert" ON public.lead_submissions;
