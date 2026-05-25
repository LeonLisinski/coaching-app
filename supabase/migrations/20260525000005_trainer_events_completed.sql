alter table public.trainer_events
  add column if not exists completed boolean not null default false;
