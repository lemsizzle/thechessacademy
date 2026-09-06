-- Stale app instances only know the original one-argument RPC. Route those
-- calls to the latest focused round while the two-argument app rollout lands.
create or replace function public.award_survival_tactical_badges(p_student_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  select a.session_id into v_session_id
  from public.student_puzzle_attempts a
  where a.student_id = p_student_id
    and a.training_mode = 'survival'
    and a.solved
    and a.selected_theme <> 'mixed'
  order by coalesce(a.completed_at, a.attempted_at) desc, a.id desc
  limit 1;

  if v_session_id is null then
    return '[]'::jsonb;
  end if;
  return public.award_survival_tactical_badges(p_student_id, v_session_id);
end;
$$;

revoke all on function public.award_survival_tactical_badges(uuid)
  from public, anon, authenticated;
grant execute on function public.award_survival_tactical_badges(uuid)
  to service_role;
