-- ─────────────────────────────────────────────────────────────────────────────
-- Chat media: allow trainers to send images/videos in chat messages
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds optional media fields to messages. Text-only messages keep
-- media_type = NULL and media_path = NULL (backward compat).
-- A message may have content OR media OR both.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_path text;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_media_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('image', 'video'));

-- ── Chat media storage bucket ────────────────────────────────────────────────
-- Private bucket. Path: {trainer_id}/{client_id}/{timestamp}.{ext}
-- RLS allows: trainer and the matching client to read; trainer to write.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  52428800, -- 50 MiB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4',  'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Storage policies ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_media_insert"         ON storage.objects;
DROP POLICY IF EXISTS "chat_media_delete"         ON storage.objects;
DROP POLICY IF EXISTS "chat_media_select_trainer" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_select_client"  ON storage.objects;

-- Trainer can write their own folder: {trainer_id}/...
CREATE POLICY "chat_media_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "chat_media_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Trainer can read their own folder
CREATE POLICY "chat_media_select_trainer"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Client can read media sent by their trainer
CREATE POLICY "chat_media_select_client"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid()
        AND c.trainer_id::text = split_part(name, '/', 1)
    )
  );
