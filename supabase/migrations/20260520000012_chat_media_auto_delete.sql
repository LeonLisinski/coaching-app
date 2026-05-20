-- Automatically delete the storage object when a message with media is deleted.
-- This prevents orphaned files accumulating in the chat-media bucket.

CREATE OR REPLACE FUNCTION public.delete_chat_media_on_message_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.media_path IS NOT NULL THEN
    -- storage.delete() removes the object from the bucket.
    -- Errors are swallowed — a missing object is not fatal.
    BEGIN
      PERFORM storage.delete('chat-media', OLD.media_path);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_chat_media ON public.messages;

CREATE TRIGGER trg_delete_chat_media
  AFTER DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_chat_media_on_message_delete();
