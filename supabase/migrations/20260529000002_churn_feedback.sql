create table if not exists public.churn_feedback (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.churn_feedback enable row level security;
create policy churn_feedback_admin_only on public.churn_feedback
  for all using (false) with check (false);

-- One feedback per trainer (upsert pattern)
create unique index if not exists churn_feedback_trainer_idx on public.churn_feedback (trainer_id);
create index if not exists churn_feedback_reason_idx on public.churn_feedback (reason);
