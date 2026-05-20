-- Increase chat-media bucket file size limit to 100 MiB.
-- Rationale: after iOS H.264 1080p transcoding (videoExportPreset),
-- a 9-second video is ~5-8 MB. 100 MiB covers even long (60s+) clips.
-- Android videos are typically H.264 already and well under this limit.
UPDATE storage.buckets
SET file_size_limit = 104857600  -- 100 MiB
WHERE id = 'chat-media';
