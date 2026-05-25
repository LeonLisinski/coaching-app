-- Fix FK constraints on workout_logs, nutrition_logs, daily_logs
-- to ON DELETE CASCADE so deleting a client row cascades cleanly.
-- Previously these were NO ACTION which blocked client deletion.

ALTER TABLE public.workout_logs
  DROP CONSTRAINT IF EXISTS workout_logs_client_id_fkey,
  ADD CONSTRAINT workout_logs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.nutrition_logs
  DROP CONSTRAINT IF EXISTS nutrition_logs_client_id_fkey,
  ADD CONSTRAINT nutrition_logs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.daily_logs
  DROP CONSTRAINT IF EXISTS daily_logs_client_id_fkey,
  ADD CONSTRAINT daily_logs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
