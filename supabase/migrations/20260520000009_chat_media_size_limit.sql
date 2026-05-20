-- Increase chat-media bucket file size limit to 200 MiB
-- (iPhone 4K ProRes videos can be 50-100+ MB for even short clips)
UPDATE storage.buckets
SET file_size_limit = 209715200  -- 200 MiB
WHERE id = 'chat-media';
