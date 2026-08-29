-- Persist server-verified Star Wars runs so scores can be shared across
-- devices and ranked without trusting browser-only localStorage values.

create table if not exists public.student_star_wars_runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  run_id uuid not null,
  generator_version smallint not null,
  run_variant bigint not null,
  score smallint not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_star_wars_generator_version_valid
    check (generator_version >= 1),
  constraint student_star_wars_run_variant_valid
    check (run_variant between 0 and 4294967295),
  constraint student_star_wars_score_valid
    check (score between 0 and 500),
  unique (student_id, run_id)
);

comment on table public.student_star_wars_runs is
  'Server-verified Star Wars puzzle runs for personal records and Academy leaderboards.';

create index if not exists student_star_wars_runs_student_best_idx
  on public.student_star_wars_runs (student_id, score desc)
  where score > 0;

create index if not exists student_star_wars_runs_leaderboard_idx
  on public.student_star_wars_runs (updated_at desc, student_id, score desc)
  where score > 0;

alter table public.student_star_wars_runs enable row level security;

revoke all on table public.student_star_wars_runs
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.student_star_wars_runs to service_role;

drop policy if exists "Star Wars runs are server-only"
  on public.student_star_wars_runs;
create policy "Star Wars runs are server-only"
  on public.student_star_wars_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.get_star_wars_leaderboard()
returns table (
  student_id uuid,
  all_time_score integer,
  month_score integer,
  week_score integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    run.student_id,
    max(run.score)::integer as all_time_score,
    coalesce(
      max(run.score) filter (where run.updated_at >= now() - interval '30 days'),
      0
    )::integer as month_score,
    coalesce(
      max(run.score) filter (where run.updated_at >= now() - interval '7 days'),
      0
    )::integer as week_score
  from public.student_star_wars_runs as run
  where run.score > 0
  group by run.student_id;
$$;

revoke all on function public.get_star_wars_leaderboard()
  from public, anon, authenticated, service_role;
grant execute on function public.get_star_wars_leaderboard() to service_role;

comment on function public.get_star_wars_leaderboard() is
  'Service-role-only best verified Star Wars run per student for leaderboard windows.';
