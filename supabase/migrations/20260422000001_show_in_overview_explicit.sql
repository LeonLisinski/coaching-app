-- Stupac show_in_overview obično dodaje 20260421000002_checkin_parameters_show_in_overview.sql.
-- Ako ta migracija nije primijenjena, ovdje ga osiguravamo (idempotentno).
ALTER TABLE public.checkin_parameters
  ADD COLUMN IF NOT EXISTS show_in_overview boolean NOT NULL DEFAULT false;

-- Eksplicitan odabir (max 3), ne default za sve retke.
ALTER TABLE public.checkin_parameters
  ALTER COLUMN show_in_overview SET DEFAULT false;

UPDATE public.checkin_parameters
SET show_in_overview = false;

COMMENT ON COLUMN public.checkin_parameters.show_in_overview IS
  'Trainer marks up to 3 numeric (daily/weekly) parameters; shown on every client weekly snapshot carousel.';
