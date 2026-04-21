-- Trainer can hide a weekly numeric parameter from the client overview picker (gear on client Pregled).
ALTER TABLE public.checkin_parameters
  ADD COLUMN IF NOT EXISTS show_in_overview boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.checkin_parameters.show_in_overview IS
  'If true, parameter may appear in the per-client overview parameter picker (max 3 per client).';
