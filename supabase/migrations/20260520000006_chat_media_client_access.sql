-- ─────────────────────────────────────────────────────────────────────────────
-- Allow clients to upload to and read from chat-media bucket
-- ─────────────────────────────────────────────────────────────────────────────
-- Existing trainer policies use path {trainerId}/{clientId}/{ts}.ext
-- New client upload path: {clientUserId}/{ts}.ext
-- Read: any authenticated user can read chat-media (access is governed by
--       the messages table RLS; the file URL itself is in a private message).

-- Drop existing restrictive select policies and replace with one that
-- lets any authenticated user read (both trainer and client).
DROP POLICY IF EXISTS "chat_media_select_trainer" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_select_client"  ON storage.objects;

CREATE POLICY "chat_media_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-media');

-- Allow clients to INSERT into their own folder (path starts with their uid)
-- The existing chat_media_insert policy already covers this since it checks
-- split_part(name, '/', 1) = auth.uid()::text — valid for both trainers and clients.
-- Nothing to add for INSERT.

-- UPDATE policy also already covers own-folder path; nothing to add.
