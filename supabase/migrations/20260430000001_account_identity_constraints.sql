-- ─────────────────────────────────────────────────────────────────────────────
-- Account identity invariants for trainer-client relationships
-- ─────────────────────────────────────────────────────────────────────────────
-- Goals:
--   1) A trainer cannot insert the same client twice (same user_id).
--   2) A single auth user (= one email = one identity) cannot have more than
--      ONE active trainer-client relationship at a time. To switch trainers
--      the previous relationship must be inactivated first.
--   3) Faster case-insensitive email lookup in `profiles` for the new
--      "find-or-invite" flow in the create-client edge function.
--
-- IMPORTANT: If existing data violates these constraints the migration will
-- abort. The diagnostic block below surfaces violations as NOTICEs *before*
-- the constraints are added so you can see exactly what to clean up.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Diagnostic: surface violations as NOTICE before constraints are added ─────
DO $$
DECLARE
  dup_per_trainer integer;
  dup_active      integer;
BEGIN
  SELECT count(*) INTO dup_per_trainer
  FROM (
    SELECT trainer_id, user_id
    FROM public.clients
    GROUP BY trainer_id, user_id
    HAVING count(*) > 1
  ) s;

  SELECT count(*) INTO dup_active
  FROM (
    SELECT user_id
    FROM public.clients
    WHERE active = true
    GROUP BY user_id
    HAVING count(*) > 1
  ) s;

  IF dup_per_trainer > 0 THEN
    RAISE NOTICE 'WARNING: % (trainer_id, user_id) duplicates exist in public.clients. The UNIQUE constraint will fail. Remove duplicates first (keep the most recent row per pair).', dup_per_trainer;
  END IF;
  IF dup_active > 0 THEN
    RAISE NOTICE 'WARNING: % users have more than one active row in public.clients. The partial UNIQUE INDEX will fail. Inactivate the older relationship(s) first.', dup_active;
  END IF;
END $$;

-- ── 1. UNIQUE (trainer_id, user_id) — no duplicate clients per trainer ────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_unique_per_trainer'
      AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_unique_per_trainer UNIQUE (trainer_id, user_id);
  END IF;
END $$;

-- ── 2. Partial UNIQUE INDEX — at most one active relationship per user ────────
CREATE UNIQUE INDEX IF NOT EXISTS clients_one_active_per_user
  ON public.clients (user_id)
  WHERE active = true;

-- ── 3. Normalize legacy mixed-case profile emails ─────────────────────────────
-- The new find-or-invite flow in create-client uses .eq('email', email) where
-- email is .toLowerCase()'d. Any legacy row stored with mixed case would miss
-- this lookup and fall through to the invite path against an existing auth
-- user (cryptic error). One-time normalize keeps storage canonical.
UPDATE public.profiles
SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

-- ── 4. Case-insensitive index on profiles.email for fast lookup ───────────────
CREATE INDEX IF NOT EXISTS profiles_email_lower_idx
  ON public.profiles (lower(email));

COMMENT ON CONSTRAINT clients_unique_per_trainer ON public.clients
  IS 'A trainer can only add the same auth user as a client once. Reactivate the existing row instead of inserting a duplicate.';

COMMENT ON INDEX public.clients_one_active_per_user
  IS 'Enforces that a person has at most one active trainer at any time. To switch trainers, inactivate the previous relationship first.';
