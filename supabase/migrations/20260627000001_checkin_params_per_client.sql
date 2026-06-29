-- Per-client check-in parameter customisation
--
-- 1. checkin_config gets an excluded_parameter_ids column so trainers can
--    hide specific global parameters for individual clients.
-- 2. checkin_parameters gets a nullable client_id column so trainers can
--    create extra parameters that only appear for a single client.

-- ── 1. excluded_parameter_ids on checkin_config ───────────────────────────────
ALTER TABLE public.checkin_config
  ADD COLUMN IF NOT EXISTS excluded_parameter_ids uuid[] NOT NULL DEFAULT '{}';

-- ── 2. client_id on checkin_parameters ───────────────────────────────────────
ALTER TABLE public.checkin_parameters
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_checkin_parameters_client_id
  ON public.checkin_parameters(client_id)
  WHERE client_id IS NOT NULL;

-- ── 3. RLS: allow trainers to insert/update client-specific parameters ─────────
-- The existing RLS on checkin_parameters already allows trainer access by
-- trainer_id. No changes needed there — client_id is just an extra nullable
-- column and existing policies cover the trainer_id check.
