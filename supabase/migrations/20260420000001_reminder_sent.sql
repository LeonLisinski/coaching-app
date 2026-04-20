-- Dedupe keys for automated reminder emails (check-in, package expiry, pending payment).
create table if not exists public.reminder_sent (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists reminder_sent_kind_created_idx on public.reminder_sent (kind, created_at desc);

alter table public.reminder_sent enable row level security;
