-- Check-in parameters the trainer marks for the client overview snapshot carousel (max 3 per client — enforced in app).
CREATE TABLE IF NOT EXISTS public.client_tracked_checkin_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  parameter_id uuid NOT NULL REFERENCES public.checkin_parameters (id) ON DELETE CASCADE,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, parameter_id)
);

CREATE INDEX IF NOT EXISTS idx_client_tracked_checkin_params_client
  ON public.client_tracked_checkin_parameters (client_id);

COMMENT ON TABLE public.client_tracked_checkin_parameters IS
  'Trainer-selected weekly numeric check-in parameters (max 3) for overview snapshot carousel.';
