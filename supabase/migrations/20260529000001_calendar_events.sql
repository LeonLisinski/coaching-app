-- Calendar events for admin + presentation completion tracking
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  event_time time without time zone,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.demo_bookings add column if not exists completed_at timestamptz;

alter table public.calendar_events enable row level security;

-- All access goes through the admin service-role client; block anon/auth entirely.
drop policy if exists calendar_events_admin_only on public.calendar_events;
create policy calendar_events_admin_only on public.calendar_events
  for all using (false) with check (false);

create index if not exists calendar_events_date_idx on public.calendar_events (event_date);
