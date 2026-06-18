-- Cron query: .eq('checkin_day', todayDow) on checkin_config table
-- Without this index, the daily cron does a full table scan of checkin_config every day.
CREATE INDEX IF NOT EXISTS idx_checkin_config_checkin_day
  ON public.checkin_config (checkin_day);
