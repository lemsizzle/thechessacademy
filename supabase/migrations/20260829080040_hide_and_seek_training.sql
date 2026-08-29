-- Persist server-verified Hide and Seek training rounds without exposing
-- placements, selections, or student results directly to browser clients.

create table if not exists public.student_hide_and_seek_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  round_id uuid not null,
  generator_version smallint not null,
  seed text not null,
  piece_placement jsonb not null,
  selected_squares text[] not null,
  safe_square_count smallint not null,
  correct_count smallint not null,
  wrong_count smallint not null,
  found_percent numeric(5, 1) not null,
  elapsed_ms integer not null,
  score smallint not null,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint student_hide_and_seek_generator_version_valid
    check (generator_version >= 1),
  constraint student_hide_and_seek_seed_valid
    check (seed ~ '^[0-9a-f]{32}$'),
  constraint student_hide_and_seek_piece_placement_valid
    check (jsonb_typeof(piece_placement) = 'array' and jsonb_array_length(piece_placement) = 8),
  constraint student_hide_and_seek_selected_squares_valid
    check (cardinality(selected_squares) between 1 and 56),
  constraint student_hide_and_seek_safe_square_count_valid
    check (safe_square_count between 10 and 24),
  constraint student_hide_and_seek_correct_count_valid
    check (correct_count between 0 and safe_square_count),
  constraint student_hide_and_seek_wrong_count_valid
    check (wrong_count between 0 and 56 - safe_square_count),
  constraint student_hide_and_seek_mark_count_valid
    check (correct_count + wrong_count = cardinality(selected_squares)),
  constraint student_hide_and_seek_found_percent_valid
    check (found_percent between 0 and 100),
  constraint student_hide_and_seek_elapsed_valid
    check (elapsed_ms between 0 and 1800000),
  constraint student_hide_and_seek_score_valid
    check (score between 0 and 1000),
  constraint student_hide_and_seek_completion_order_valid
    check (completed_at >= started_at),
  unique (student_id, round_id)
);

comment on table public.student_hide_and_seek_attempts is
  'Server-verified Hide and Seek board-vision attempts for student records and teacher leaderboards.';

create index if not exists student_hide_and_seek_attempts_student_latest_idx
  on public.student_hide_and_seek_attempts (student_id, completed_at desc);

create index if not exists student_hide_and_seek_attempts_leaderboard_idx
  on public.student_hide_and_seek_attempts (completed_at desc, student_id, score desc);

create index if not exists student_hide_and_seek_attempts_personal_best_idx
  on public.student_hide_and_seek_attempts (student_id, score desc);

alter table public.student_hide_and_seek_attempts enable row level security;

revoke all on table public.student_hide_and_seek_attempts
  from public, anon, authenticated, service_role;
grant select, insert on table public.student_hide_and_seek_attempts to service_role;

drop policy if exists "Hide and Seek attempts are server-only"
  on public.student_hide_and_seek_attempts;
create policy "Hide and Seek attempts are server-only"
  on public.student_hide_and_seek_attempts
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.get_hide_and_seek_leaderboard()
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
    attempt.student_id,
    max(attempt.score)::integer as all_time_score,
    coalesce(
      max(attempt.score) filter (where attempt.completed_at >= now() - interval '30 days'),
      0
    )::integer as month_score,
    coalesce(
      max(attempt.score) filter (where attempt.completed_at >= now() - interval '7 days'),
      0
    )::integer as week_score
  from public.student_hide_and_seek_attempts as attempt
  group by attempt.student_id;
$$;

revoke all on function public.get_hide_and_seek_leaderboard()
  from public, anon, authenticated, service_role;
grant execute on function public.get_hide_and_seek_leaderboard() to service_role;

comment on function public.get_hide_and_seek_leaderboard() is
  'Service-role-only best Hide and Seek score per student for teacher leaderboard windows.';

create or replace function public.get_student_hide_and_seek_overview(p_student_id uuid)
returns table (
  attempts bigint,
  personal_best integer,
  average_found_percent numeric,
  average_wrong_count numeric,
  average_elapsed_ms numeric,
  latest_attempt_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) as attempts,
    coalesce(max(attempt.score), 0)::integer as personal_best,
    coalesce(round(avg(attempt.found_percent), 1), 0) as average_found_percent,
    coalesce(round(avg(attempt.wrong_count), 1), 0) as average_wrong_count,
    coalesce(round(avg(attempt.elapsed_ms)), 0) as average_elapsed_ms,
    max(attempt.completed_at) as latest_attempt_at
  from public.student_hide_and_seek_attempts as attempt
  where attempt.student_id = p_student_id;
$$;

revoke all on function public.get_student_hide_and_seek_overview(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_student_hide_and_seek_overview(uuid) to service_role;

comment on function public.get_student_hide_and_seek_overview(uuid) is
  'Service-role-only account summary for a student''s Hide and Seek training history.';
