-- Real reward triggers, temporary students, and an unconditional transaction rollback.
begin;
set local statement_timeout = '20s';
set local role service_role;
do $$
declare
  student uuid; other_student uuid; round_id uuid := gen_random_uuid();
  next_round uuid := gen_random_uuid(); result jsonb; first_result jsonb; awards jsonb;
  n integer;
begin
  insert into public.students(display_name,public_slug,is_active)
    values('Temporary Survival rewards test','survival-rewards-test-'||gen_random_uuid(),true) returning id into student;
  insert into public.students(display_name,public_slug,is_active)
    values('Temporary Survival rewards isolation','survival-rewards-test-'||gen_random_uuid(),true) returning id into other_student;
  assert public.get_survival_round_rewards(student,round_id) =
    '{"xp":0,"puzzleCoins":0,"badgeCoins":0,"badges":[]}'::jsonb, 'Empty round is not zero';

  insert into public.student_puzzle_attempts(student_id,puzzle_id,session_id,selected_theme,training_mode,solved,completed_at)
    select student,id,round_id,'pin','survival',true,now()
    from public.chess_puzzles where 'pin'=any(themes) limit 40;
  get diagnostics n = row_count;
  assert n=40, 'Need 40 fixture puzzles';
  awards := public.award_survival_tactical_badges(student,round_id);
  assert jsonb_array_length(awards)=4, 'Expected four badge tiers';
  result := public.get_survival_round_rewards(student,round_id);
  assert (result->>'xp')::int=80, 'Incorrect actual XP';
  assert (result->>'puzzleCoins')::int=80, 'Incorrect puzzle coins';
  assert (result->>'badgeCoins')::int=360, 'Incorrect badge coins';
  assert jsonb_array_length(result->'badges')=4, 'Missing badge artwork rows';
  assert not exists(select 1 from jsonb_array_elements(result->'badges') badge
    where coalesce(badge->>'imageUrl','')=''), 'Missing earned artwork';
  first_result := result;

  -- Retried saves and award requests must not duplicate either ledger.
  update public.student_puzzle_attempts set solved=true where student_id=student and session_id=round_id;
  assert public.award_survival_tactical_badges(student,round_id)='[]'::jsonb, 'Retried awards duplicated';
  assert public.get_survival_round_rewards(student,round_id)=first_result, 'Retry changed totals';
  assert public.get_survival_round_rewards(other_student,round_id)=
    '{"xp":0,"puzzleCoins":0,"badgeCoins":0,"badges":[]}'::jsonb, 'Student isolation failed';

  -- Same puzzles in another round earn puzzle rewards, but no old badges.
  insert into public.student_puzzle_attempts(student_id,puzzle_id,session_id,selected_theme,training_mode,solved,completed_at)
    select student,puzzle_id,next_round,'pin','survival',true,now()
    from public.student_puzzle_attempts where student_id=student and session_id=round_id;
  assert public.award_survival_tactical_badges(student,next_round)='[]'::jsonb, 'Old badges awarded again';
  result := public.get_survival_round_rewards(student,next_round);
  assert (result->>'xp')::int=80 and (result->>'puzzleCoins')::int=80, 'New round puzzle rewards wrong';
  assert (result->>'badgeCoins')::int=0 and result->'badges'='[]'::jsonb, 'Old badge shown in new round';
  assert public.get_survival_round_rewards(student,round_id)=first_result, 'Another round changed first round totals';

  assert not has_function_privilege('anon','public.get_survival_round_rewards(uuid,uuid)','execute'), 'Anonymous RPC access';
  assert not has_function_privilege('authenticated','public.get_survival_round_rewards(uuid,uuid)','execute'), 'Public RPC access';
end;
$$;
rollback;
select 'PASS: actual XP/coins, four artwork awards, retries, round/student isolation and restricted access; all fixtures rolled back' as result;
