-- Lichess sync safety state for The Chess Academy Quest Board.
-- Safe to run in Supabase SQL Editor. This file only adds/updates objects.
-- It does not drop tables, truncate data, or delete rows.

create table if not exists public.lichess_sync_state (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  lichess_username text not null,
  last_successful_sync_at timestamptz,
  last_attempted_sync_at timestamptz,
  next_allowed_sync_at timestamptz,
  last_error text,
  rate_limit_count integer not null default 0,
  request_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lichess_sync_state
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists student_id uuid references public.students(id) on delete cascade,
  add column if not exists lichess_username text,
  add column if not exists last_successful_sync_at timestamptz,
  add column if not exists last_attempted_sync_at timestamptz,
  add column if not exists next_allowed_sync_at timestamptz,
  add column if not exists last_error text,
  add column if not exists rate_limit_count integer not null default 0,
  add column if not exists request_count integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists lichess_sync_state_student_id_key
  on public.lichess_sync_state(student_id)
  where student_id is not null;

create unique index if not exists lichess_sync_state_student_id_unique
  on public.lichess_sync_state(student_id);

create index if not exists lichess_sync_state_next_allowed_idx
  on public.lichess_sync_state(next_allowed_sync_at);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_lichess_sync_state_updated_at on public.lichess_sync_state;
create trigger set_lichess_sync_state_updated_at
before update on public.lichess_sync_state
for each row execute function public.set_updated_at();

alter table public.lichess_sync_state enable row level security;

drop policy if exists "No public reads for lichess sync state" on public.lichess_sync_state;
drop policy if exists "No public writes for lichess sync state" on public.lichess_sync_state;

-- Keep sync state private. Server-side code uses SUPABASE_SERVICE_ROLE_KEY.
create policy "No public reads for lichess sync state"
on public.lichess_sync_state
for select
to anon, authenticated
using (false);

create policy "No public writes for lichess sync state"
on public.lichess_sync_state
for all
to anon, authenticated
using (false)
with check (false);
