-- Exercises the trainer marks for analytics (max 10 per client — enforced in app).
CREATE TABLE IF NOT EXISTS public.client_tracked_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_client_tracked_exercises_client
  ON public.client_tracked_exercises (client_id);

COMMENT ON TABLE public.client_tracked_exercises IS
  'Trainer-selected exercises (max 10) used for per-exercise analytics charts.';
