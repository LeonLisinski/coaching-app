-- Allow any authenticated user to read exercise-media (create signed URLs).
-- RLS on the exercises table already controls which exercises a client can see.
-- Signed URLs expire after 1h so this doesn't meaningfully weaken security.
DROP POLICY IF EXISTS "exercise_media_select_trainer" ON storage.objects;
DROP POLICY IF EXISTS "exercise_media_select_client"  ON storage.objects;

CREATE POLICY "exercise_media_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'exercise-media');
