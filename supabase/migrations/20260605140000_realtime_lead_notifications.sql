-- Enable realtime for trainer_notifications and lead_submissions so the
-- dashboard layout can receive INSERT/UPDATE events without polling.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trainer_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trainer_notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'lead_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_submissions;
  END IF;
END $$;
