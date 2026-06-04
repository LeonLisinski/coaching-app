-- Weekly reports: trainer-generated snapshot reports of a client's
-- training/nutrition/checkin progress over a date range. Snapshots are
-- frozen at creation time so historical reports remain stable even if
-- underlying logs are later edited.

create table if not exists public.client_weekly_reports (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  trainer_id      uuid not null,
  range_start     date not null,
  range_end       date not null,
  is_partial      boolean not null default false,
  snapshot        jsonb not null,
  trainer_notes   text,
  visible_to_client boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint client_weekly_reports_range_chk
    check (range_end >= range_start)
);

create index if not exists client_weekly_reports_client_idx
  on public.client_weekly_reports (client_id, range_end desc);

create index if not exists client_weekly_reports_trainer_idx
  on public.client_weekly_reports (trainer_id, created_at desc);

-- Updated_at touch trigger
create or replace function public.client_weekly_reports_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_client_weekly_reports_updated_at on public.client_weekly_reports;
create trigger trg_client_weekly_reports_updated_at
  before update on public.client_weekly_reports
  for each row execute function public.client_weekly_reports_touch_updated_at();

-- RLS — same shape as nutrition_logs / workout_logs for consistency.
alter table public.client_weekly_reports enable row level security;

-- Trainers manage their own clients' reports (full access).
drop policy if exists "Trainers manage own weekly reports" on public.client_weekly_reports;
create policy "Trainers manage own weekly reports"
  on public.client_weekly_reports
  for all
  to public
  using (trainer_id = (select auth.uid()))
  with check (trainer_id = (select auth.uid()));

-- Clients can read reports their trainer marked visible.
drop policy if exists "Clients read visible weekly reports" on public.client_weekly_reports;
create policy "Clients read visible weekly reports"
  on public.client_weekly_reports
  for select
  to public
  using (
    visible_to_client = true
    and exists (
      select 1
      from public.clients c
      where c.id = client_weekly_reports.client_id
        and c.user_id = (select auth.uid())
    )
  );

comment on table public.client_weekly_reports is
  'Trainer-generated weekly progress reports. snapshot column is a frozen aggregate at creation time.';
