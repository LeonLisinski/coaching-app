-- ─────────────────────────────────────────────────────────────────────────────
-- Add separate image columns to exercises
-- media_path/media_mime/media_size_bytes already track uploaded VIDEO.
-- We now add separate image columns so trainers can have ALL THREE:
--   video_url  → YouTube / external link
--   media_path → uploaded video (exercise-media bucket)
--   image_path → uploaded image (exercise-media bucket, same bucket)
-- media_type is kept for backward compat but is now only used for 'video'
-- (rows with media_type='image' will be migrated to image_path below).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS image_path       text,
  ADD COLUMN IF NOT EXISTS image_mime       text,
  ADD COLUMN IF NOT EXISTS image_size_bytes int;

-- Migrate any existing rows that used media_type='image' to the new column
UPDATE public.exercises
   SET image_path       = media_path,
       image_mime       = media_mime,
       image_size_bytes = media_size_bytes,
       media_path       = NULL,
       media_mime       = NULL,
       media_size_bytes = NULL,
       media_type       = NULL
 WHERE media_type = 'image';
