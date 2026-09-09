-- Additive reporting endpoints: existing clients remain compatible during rollout.
create or replace function public.get_star_wars_leaderboard_by_mode()
returns table (student_id uuid, mode text, time_limit_ms integer,
  all_time_score integer, month_score integer, week_score integer)
language sql stable security invoker set search_path = '' as $$
  select r.student_id, r.mode, r.time_limit_ms,
    max(r.score)::integer,
    coalesce(max(r.score) filter (where r.updated_at >= now() - interval '30 days'), 0)::integer,
    coalesce(max(r.score) filter (where r.updated_at >= now() - interval '7 days'), 0)::integer
  from public.student_star_wars_runs r
  where r.score > 0
  group by r.student_id, r.mode, r.time_limit_ms;
$$;
revoke all on function public.get_star_wars_leaderboard_by_mode() from public, anon, authenticated;
grant execute on function public.get_star_wars_leaderboard_by_mode() to service_role;

create or replace function public.get_hide_and_seek_leaderboard_by_mode()
returns table (student_id uuid, mode text,
  all_time_score integer, month_score integer, week_score integer,
  all_time_attempts bigint, month_attempts bigint, week_attempts bigint)
language sql stable security invoker set search_path = '' as $$
  select a.student_id, case when a.mode = 'hard' then 'hard' else 'standard' end,
    max(a.score)::integer,
    coalesce(max(a.score) filter (where a.completed_at >= now() - interval '30 days'), 0)::integer,
    coalesce(max(a.score) filter (where a.completed_at >= now() - interval '7 days'), 0)::integer,
    count(*),
    count(*) filter (where a.completed_at >= now() - interval '30 days'),
    count(*) filter (where a.completed_at >= now() - interval '7 days')
  from public.student_hide_and_seek_attempts a
  group by a.student_id, case when a.mode = 'hard' then 'hard' else 'standard' end;
$$;
revoke all on function public.get_hide_and_seek_leaderboard_by_mode() from public, anon, authenticated;
grant execute on function public.get_hide_and_seek_leaderboard_by_mode() to service_role;
