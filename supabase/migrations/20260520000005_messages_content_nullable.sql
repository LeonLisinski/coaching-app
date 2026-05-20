-- Allow messages without text content (e.g. image/video-only messages)
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;
