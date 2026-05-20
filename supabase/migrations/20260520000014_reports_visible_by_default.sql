-- Make weekly reports visible to clients by default.
-- The trainer can still hide a report manually via the toggle in the web app.

alter table public.client_weekly_reports
  alter column visible_to_client set default true;

-- Retroactively share all existing reports that were generated but kept invisible.
update public.client_weekly_reports
set visible_to_client = true
where visible_to_client = false;
