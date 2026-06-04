-- Trainer calendar events
create table if not exists public.trainer_events (
  id                  uuid primary key default gen_random_uuid(),
  trainer_id          uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  starts_at           timestamptz not null,
  ends_at             timestamptz,
  type                text not null default 'custom'
                        check (type in ('call', 'checkin', 'custom')),
  lead_submission_id  uuid references public.lead_submissions(id) on delete set null,
  client_id           uuid references public.profiles(id) on delete set null,
  color               text,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table public.trainer_events enable row level security;

create policy "Trainers manage own events"
  on public.trainer_events for all
  using (trainer_id = (select auth.uid()))
  with check (trainer_id = (select auth.uid()));

create index trainer_events_trainer_id_starts_at
  on public.trainer_events (trainer_id, starts_at);
