-- =============================================================================
-- Fix notify_trainer_on_lead() trigger function
--
-- Two bugs:
-- 1. `value #>> '{}'` fails because jsonb_each_text() returns text values,
--    not jsonb — the #>> operator only works on jsonb. Fix: use `value` directly.
-- 2. `ON CONFLICT (trainer_id, source_id) DO NOTHING` fails because the unique
--    index is a partial index (WHERE source_id IS NOT NULL). PostgreSQL requires
--    the matching WHERE clause in ON CONFLICT for partial indexes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_trainer_on_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  display_name text;
  ans jsonb;
BEGIN
  ans := NEW.answers;
  SELECT COALESCE(
    (SELECT value FROM jsonb_each_text(ans) WHERE key ILIKE '%ime%' OR key ILIKE '%name%' LIMIT 1),
    (SELECT value FROM jsonb_each_text(ans) WHERE key ILIKE '%email%' LIMIT 1),
    'Nepoznat'
  ) INTO display_name;

  INSERT INTO public.trainer_notifications (trainer_id, type, title, body, href, source_id)
  VALUES (
    NEW.trainer_id,
    'lead',
    'Nova prijava za coaching',
    display_name,
    '/dashboard/prijave',
    'lead-' || NEW.id::text
  )
  ON CONFLICT (trainer_id, source_id) WHERE source_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;
