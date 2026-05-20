-- ─────────────────────────────────────────────────────────────────────────────
-- exercise-media storage bucket + RLS policies
-- ─────────────────────────────────────────────────────────────────────────────
-- Private bucket. Trainers upload demo videos/photos for their custom
-- exercises. Path convention is enforced by RLS:
--   '{trainer_id}/{exercise_id}.{ext}'
--
-- Access model
--   write (insert/update/delete)
--     trainer owning the folder (split_part(name, '/', 1) = auth.uid())
--   read
--     trainer (own folder)  OR  any client whose trainer_id matches the folder

-- Bucket (idempotent — preserves limits/mime list if it already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-media',
  'exercise-media',
  false,
  15728640, -- 15 MiB safety margin (per-file limit; UI enforces 10 MB)
  ARRAY[
    'image/webp', 'image/jpeg', 'image/png',
    'video/mp4',  'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Policies ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "exercise_media_insert"        ON storage.objects;
DROP POLICY IF EXISTS "exercise_media_update"        ON storage.objects;
DROP POLICY IF EXISTS "exercise_media_delete"        ON storage.objects;
DROP POLICY IF EXISTS "exercise_media_select_trainer" ON storage.objects;
DROP POLICY IF EXISTS "exercise_media_select_client"  ON storage.objects;

-- Trainer can write to their own folder only
CREATE POLICY "exercise_media_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exercise-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "exercise_media_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exercise-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'exercise-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "exercise_media_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exercise-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Trainer can read their own folder
CREATE POLICY "exercise_media_select_trainer"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'exercise-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Clients can read media owned by their trainer
CREATE POLICY "exercise_media_select_client"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'exercise-media'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid()
        AND c.trainer_id::text = split_part(name, '/', 1)
    )
  );
