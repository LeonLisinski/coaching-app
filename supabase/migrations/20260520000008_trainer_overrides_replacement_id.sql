-- ─────────────────────────────────────────────────────────────────────────────
-- Add replacement_id to trainer_overrides for exercises
-- ─────────────────────────────────────────────────────────────────────────────
-- When a trainer forks a default exercise, we now store the new exercise's ID
-- in replacement_id. This allows client workout plan enrichment to find the
-- trainer's version exactly, without fragile name-based lookup.
--
-- Existing overrides without replacement_id (pre-migration data) will fall back
-- to name-based lookup in the mobile app for backward compatibility.

ALTER TABLE public.trainer_overrides
  ADD COLUMN IF NOT EXISTS replacement_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL;
