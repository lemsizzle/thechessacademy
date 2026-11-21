alter table public.student_chess_assessments drop constraint student_chess_assessments_version_check;
alter table public.student_chess_assessments add constraint student_chess_assessments_version_check check (version in ('knowledge-a-v1','skills-b-v1'));

create function public.save_chess_assessment_v2(p_student_id uuid,p_attempt_id uuid,p_answers jsonb,p_submit boolean,p_key jsonb,p_version text)
returns public.student_chess_assessments language plpgsql security invoker set search_path = public as $$
declare v_attempt public.student_chess_assessments; v_now timestamptz; v_count integer;
begin
  if jsonb_typeof(p_key) is distinct from 'object' or (select count(*) from jsonb_each(p_key)) <> 30 then raise exception 'Invalid answer key'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid answers'; end if;
  select * into v_attempt from public.student_chess_assessments where id=p_attempt_id and student_id=p_student_id for update;
  if not found then raise exception 'Assessment unavailable'; end if;
  if v_attempt.version <> p_version then raise exception 'Invalid assessment version'; end if;
  if exists(select 1 from jsonb_each(p_answers) a where not (p_key ? a.key) or jsonb_typeof(a.value) <> 'string' or
    (a.value #>> '{}') !~ (case when p_version='skills-b-v1' then '^([a-h][1-8][a-h][1-8][qrbn]?)?$' else '^([abcd])?$' end)) then raise exception 'Invalid answers'; end if;
  if v_attempt.completed_at is not null then return v_attempt; end if;
  v_now := clock_timestamp();
  if v_now < v_attempt.deadline_at then v_attempt.answers := v_attempt.answers || p_answers; end if;
  if p_submit or v_now >= v_attempt.deadline_at then
    select count(*) into v_count from jsonb_each(p_key) k where
      case when jsonb_typeof(k.value)='array' then k.value ? (v_attempt.answers ->> k.key) else k.value = v_attempt.answers -> k.key end;
    v_attempt.correct_count := v_count;
    v_attempt.completed_at := least(v_now,v_attempt.deadline_at);
  end if;
  update public.student_chess_assessments set answers=v_attempt.answers, correct_count=v_attempt.correct_count, completed_at=v_attempt.completed_at where id=v_attempt.id;
  return v_attempt;
end;
$$;
create function public.finish_expired_chess_assessments_v2(p_key jsonb,p_version text)
returns integer language plpgsql security invoker set search_path = public as $$
declare v_count integer;
begin
  if jsonb_typeof(p_key) is distinct from 'object' or (select count(*) from jsonb_each(p_key)) <> 30 then raise exception 'Invalid answer key'; end if;
  update public.student_chess_assessments a set completed_at=deadline_at,
    correct_count=(select count(*) from jsonb_each(p_key) k where case when jsonb_typeof(k.value)='array' then k.value ? (a.answers ->> k.key) else k.value = a.answers -> k.key end)
    where completed_at is null and deadline_at<=clock_timestamp() and version=p_version;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.save_chess_assessment_v2(uuid,uuid,jsonb,boolean,jsonb,text) from public,anon,authenticated;
revoke all on function public.finish_expired_chess_assessments_v2(jsonb,text) from public,anon,authenticated;
grant execute on function public.save_chess_assessment_v2(uuid,uuid,jsonb,boolean,jsonb,text) to service_role;
grant execute on function public.finish_expired_chess_assessments_v2(jsonb,text) to service_role;
