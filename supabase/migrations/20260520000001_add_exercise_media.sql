-- ─────────────────────────────────────────────────────────────────────────────
-- Exercise media: support uploaded video/image in addition to YouTube URL
-- ─────────────────────────────────────────────────────────────────────────────
-- video_url remains the source of truth for YouTube/external links (backward
-- compat). New columns describe an uploaded file in storage.buckets:
--   media_type:   'youtube' | 'video' | 'image'  (discriminator)
--   media_path:   storage path inside `exercise-media` bucket
--   media_mime:   mime type (image/webp, video/mp4, …)
--   media_size_bytes: original size (for diagnostics; no per-trainer quota today)
--
-- Path convention enforced by RLS: '{trainer_id}/{exercise_id}.{ext}'
-- See 20260520000002_exercise_media_bucket.sql for bucket + storage policies.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS media_type       text,
  ADD COLUMN IF NOT EXISTS media_path       text,
  ADD COLUMN IF NOT EXISTS media_mime       text,
  ADD COLUMN IF NOT EXISTS media_size_bytes int;

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_media_type_check;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('youtube','video','image'));

-- Backfill: any row that already has a video_url is implicitly a YouTube link
UPDATE public.exercises
   SET media_type = 'youtube'
 WHERE media_type IS NULL
   AND video_url IS NOT NULL
   AND length(trim(video_url)) > 0;
