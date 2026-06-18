-- Missing indexes for push_subscriptions table.
-- trainer_id is queried on every push send (fetch subs for a trainer).
-- endpoint is queried when cleaning up expired/invalid subscriptions.

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_trainer
  ON public.push_subscriptions (trainer_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON public.push_subscriptions (endpoint);

-- Index for trainer_notifications unread count (bell icon query)
-- Query: .eq('trainer_id', X).is('read_at', null).order('created_at', desc)
CREATE INDEX IF NOT EXISTS idx_trainer_notifications_trainer_unread
  ON public.trainer_notifications (trainer_id, created_at DESC)
  WHERE read_at IS NULL;

-- Index for trainer_notification_prefs lookup by trainer+type (used in cron and edge functions)
CREATE INDEX IF NOT EXISTS idx_trainer_notif_prefs_trainer_type
  ON public.trainer_notification_prefs (trainer_id, type);
