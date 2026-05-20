-- Reduce chat-media bucket file size limit to 50 MiB.
-- Rationale:
--   • Images should be compressed before upload (≤ 5 MB in practice).
--   • Short chat videos (≤ 60 s @ 720p H.264) are well under 50 MB.
--   • Keeps storage costs predictable at scale.
-- The previous 200 MiB limit was added as a hotfix for a single upload
-- failure; 50 MiB is the correct long-term limit for chat media.
UPDATE storage.buckets
SET file_size_limit = 52428800  -- 50 MiB
WHERE id = 'chat-media';

-- Also tighten allowed MIME types: drop video/quicktime (.mov).
-- .mov is Apple-only and cannot be played natively in browsers.
-- Clients should convert to .mp4 before uploading.
-- (mobile upload code already maps HEVC/MOV → MP4 or skips unsupported)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/webm'
]
WHERE id = 'chat-media';
