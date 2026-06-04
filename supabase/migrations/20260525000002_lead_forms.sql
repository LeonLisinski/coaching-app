-- ─────────────────────────────────────────────────────────────────────────────
-- Lead / intake forms: trainers can publish a public intake form that
-- prospective clients fill out. Each submission becomes a "lead".
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Public handle on trainer profiles (slug used in the public URL)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handle text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_lower_unique
  ON public.profiles (lower(handle)) WHERE handle IS NOT NULL;

-- Allow anon to read trainer profiles by handle (needed for public form page)
DROP POLICY IF EXISTS "profiles_public_handle_read" ON public.profiles;
CREATE POLICY "profiles_public_handle_read"
  ON public.profiles FOR SELECT TO anon
  USING (handle IS NOT NULL AND role = 'trainer');

-- 2. Lead forms (one per trainer)
CREATE TABLE IF NOT EXISTS public.lead_forms (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT '',
  description  text,
  accent_color text        NOT NULL DEFAULT '#7c3aed',
  photo_url    text,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trainer_id)
);

-- 3. Questions per form
CREATE TABLE IF NOT EXISTS public.lead_form_questions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid        NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  order_index integer     NOT NULL DEFAULT 0,
  type        text        NOT NULL CHECK (type IN (
    'short_text','long_text','number','email','phone',
    'single_choice','multi_choice','date','yes_no'
  )),
  label       text        NOT NULL,
  required    boolean     NOT NULL DEFAULT false,
  options     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. Submissions
CREATE TABLE IF NOT EXISTS public.lead_submissions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id           uuid        NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  trainer_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers           jsonb       NOT NULL DEFAULT '{}',
  status            text        NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','converted','rejected')),
  scheduled_call_at timestamptz,
  trainer_notes     text,
  seen              boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS lead_form_questions_form_idx
  ON public.lead_form_questions(form_id, order_index);
CREATE INDEX IF NOT EXISTS lead_submissions_trainer_idx
  ON public.lead_submissions(trainer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_submissions_unseen_idx
  ON public.lead_submissions(trainer_id, seen) WHERE seen = false;

-- RLS
ALTER TABLE public.lead_forms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_form_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_submissions     ENABLE ROW LEVEL SECURITY;

-- lead_forms
DROP POLICY IF EXISTS "lead_forms_trainer"     ON public.lead_forms;
DROP POLICY IF EXISTS "lead_forms_public_read" ON public.lead_forms;

CREATE POLICY "lead_forms_trainer"
  ON public.lead_forms FOR ALL
  USING (trainer_id = (select auth.uid()))
  WITH CHECK (trainer_id = (select auth.uid()));

CREATE POLICY "lead_forms_public_read"
  ON public.lead_forms FOR SELECT TO anon
  USING (is_active = true);

-- lead_form_questions
DROP POLICY IF EXISTS "lead_form_questions_trainer"     ON public.lead_form_questions;
DROP POLICY IF EXISTS "lead_form_questions_public_read" ON public.lead_form_questions;

CREATE POLICY "lead_form_questions_trainer"
  ON public.lead_form_questions FOR ALL
  USING  (form_id IN (SELECT id FROM public.lead_forms WHERE trainer_id = (select auth.uid())))
  WITH CHECK (form_id IN (SELECT id FROM public.lead_forms WHERE trainer_id = (select auth.uid())));

CREATE POLICY "lead_form_questions_public_read"
  ON public.lead_form_questions FOR SELECT TO anon
  USING (form_id IN (SELECT id FROM public.lead_forms WHERE is_active = true));

-- lead_submissions
DROP POLICY IF EXISTS "lead_submissions_trainer"     ON public.lead_submissions;
DROP POLICY IF EXISTS "lead_submissions_anon_insert" ON public.lead_submissions;

CREATE POLICY "lead_submissions_trainer"
  ON public.lead_submissions FOR ALL
  USING (trainer_id = (select auth.uid()));

CREATE POLICY "lead_submissions_anon_insert"
  ON public.lead_submissions FOR INSERT TO anon
  WITH CHECK (true);
