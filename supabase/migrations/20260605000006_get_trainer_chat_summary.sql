-- =============================================================================
-- get_trainer_chat_summary — captures the function definition that already exists
-- in the live database so the repo stays in sync.
--
-- Returns the latest message and unread count per client for a given trainer,
-- used by coaching-app/app/dashboard/chat/page.tsx to build the chat sidebar.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_trainer_chat_summary(p_trainer_id uuid)
RETURNS TABLE (
  client_id       uuid,
  last_content    text,
  last_created_at timestamptz,
  last_sender_id  uuid,
  unread_count    bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    latest.client_id,
    latest.content        AS last_content,
    latest.created_at     AS last_created_at,
    latest.sender_id      AS last_sender_id,
    COALESCE(unread.cnt, 0) AS unread_count
  FROM (
    -- Cheapest-possible latest-message-per-client using DISTINCT ON
    SELECT DISTINCT ON (client_id)
      client_id, content, created_at, sender_id
    FROM messages
    WHERE trainer_id = p_trainer_id
    ORDER BY client_id, created_at DESC
  ) latest
  LEFT JOIN (
    SELECT client_id, COUNT(*) AS cnt
    FROM messages
    WHERE trainer_id = p_trainer_id
      AND sender_id  != p_trainer_id
      AND read        = false
    GROUP BY client_id
  ) unread USING (client_id)
$$;
