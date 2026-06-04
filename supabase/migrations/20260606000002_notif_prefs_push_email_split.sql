-- =============================================================================
-- Split notification prefs into separate push + email columns per type.
-- Default: push = true (on by default), email = false (opt-in).
-- =============================================================================

ALTER TABLE public.client_notification_prefs
  -- New message
  ADD COLUMN IF NOT EXISTS new_message_push          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS new_message_email         boolean NOT NULL DEFAULT false,
  -- Check-in day before
  ADD COLUMN IF NOT EXISTS checkin_day_before_push   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkin_day_before_email  boolean NOT NULL DEFAULT false,
  -- Check-in day of
  ADD COLUMN IF NOT EXISTS checkin_day_of_push       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkin_day_of_email      boolean NOT NULL DEFAULT false,
  -- Check-in comment
  ADD COLUMN IF NOT EXISTS checkin_comment_push      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkin_comment_email     boolean NOT NULL DEFAULT false,
  -- Daily log reminder
  ADD COLUMN IF NOT EXISTS daily_log_reminder_push   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_log_reminder_email  boolean NOT NULL DEFAULT false;

-- Migrate existing data: old column true → new push true (already the default)
-- Old columns are kept for backwards compat, but edge functions will use new ones.
-- We copy old "disabled" state to push columns so existing opt-outs are respected.
UPDATE public.client_notification_prefs SET
  new_message_push         = new_message,
  checkin_day_before_push  = checkin_day_before,
  checkin_day_of_push      = checkin_day_of,
  checkin_comment_push     = checkin_comment,
  daily_log_reminder_push  = daily_log_reminder;

-- Drop old single-column booleans (they are replaced by _push/_email pairs)
ALTER TABLE public.client_notification_prefs
  DROP COLUMN IF EXISTS new_message,
  DROP COLUMN IF EXISTS checkin_day_before,
  DROP COLUMN IF EXISTS checkin_day_of,
  DROP COLUMN IF EXISTS checkin_comment,
  DROP COLUMN IF EXISTS daily_log_reminder;
