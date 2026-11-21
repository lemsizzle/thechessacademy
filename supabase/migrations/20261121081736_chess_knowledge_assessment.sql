create table public.student_chess_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  version text not null check (version = 'knowledge-a-v1'),
  started_at timestamptz not null default clock_timestamp(),
  deadline_at timestamptz not null default (clock_timestamp() + interval '30 minutes'),
  completed_at timestamptz,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  correct_count integer check (correct_count between 0 and 30),
  check ((completed_at is null) = (correct_count is null))
);
create unique index student_chess_assessment_active on public.student_chess_assessments(student_id) where completed_at is null;
create index student_chess_assessment_history on public.student_chess_assessments(student_id, started_at desc);
alter table public.student_chess_assessments enable row level security;
revoke all on public.student_chess_assessments from public, anon, authenticated;
grant all on public.student_chess_assessments to service_role;

-- These functions are called only by authenticated app routes using the service role.
-- The student ID and answer key never come from a browser's claimed identity/key.
create function public.start_chess_assessment(p_student_id uuid, p_version text)
returns public.student_chess_assessments language plpgsql security invoker set search_path = public as $$
declare v_attempt public.student_chess_assessments;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text, 8412));
  if not exists (select 1 from public.students where id = p_student_id and is_active = true) then
    raise exception 'Student unavailable';
  end if;
  select * into v_attempt from public.student_chess_assessments where student_id = p_student_id and completed_at is null;
  if found then return v_attempt; end if;
  insert into public.student_chess_assessments(student_id, version) values(p_student_id, p_version) returning * into v_attempt;
  return v_attempt;
end;
$$;

create function public.save_chess_assessment(p_student_id uuid, p_attempt_id uuid, p_answers jsonb, p_submit boolean, p_key jsonb)
returns public.student_chess_assessments language plpgsql security invoker set search_path = public as $$
declare v_attempt public.student_chess_assessments; v_now timestamptz; v_count integer;
begin
  if jsonb_typeof(p_key) is distinct from 'object' or (select count(*) from jsonb_each(p_key)) <> 30 then
    raise exception 'Invalid answer key';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid answers'; end if;
  if exists (select 1 from jsonb_each(p_answers) a where not (p_key ? a.key) or a.value not in ('"a"'::jsonb, '"b"'::jsonb, '"c"'::jsonb, '"d"'::jsonb, '""'::jsonb)) then
    raise exception 'Invalid answers';
  end if;
  select * into v_attempt from public.student_chess_assessments where id = p_attempt_id and student_id = p_student_id for update;
  if not found then raise exception 'Assessment unavailable'; end if;
  if v_attempt.completed_at is not null then return v_attempt; end if;
  v_now := clock_timestamp();
  -- An expired session can be graded, but late answers cannot change its score.
  if v_now < v_attempt.deadline_at then v_attempt.answers := v_attempt.answers || p_answers; end if;
  if p_submit or v_now >= v_attempt.deadline_at then
    select count(*) into v_count from jsonb_each_text(p_key) k where v_attempt.answers ->> k.key = k.value;
    v_attempt.correct_count := v_count;
    v_attempt.completed_at := least(v_now, v_attempt.deadline_at);
  end if;
  update public.student_chess_assessments set answers = v_attempt.answers, correct_count = v_attempt.correct_count, completed_at = v_attempt.completed_at where id = v_attempt.id;
  return v_attempt;
end;
$$;
revoke all on function public.start_chess_assessment(uuid, text) from public, anon, authenticated;
revoke all on function public.save_chess_assessment(uuid, uuid, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.start_chess_assessment(uuid, text) to service_role;
grant execute on function public.save_chess_assessment(uuid, uuid, jsonb, boolean, jsonb) to service_role;

-- Grade abandoned, expired tests when the teacher opens results; no scheduled job
-- or browser polling is needed. Concurrent saves lock the same rows normally.
create function public.finish_expired_chess_assessments(p_key jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare v_count integer;
begin
  if jsonb_typeof(p_key) is distinct from 'object' or (select count(*) from jsonb_each(p_key)) <> 30 then raise exception 'Invalid answer key'; end if;
  update public.student_chess_assessments a set completed_at = deadline_at,
    correct_count = (select count(*) from jsonb_each_text(p_key) k where a.answers ->> k.key = k.value)
    where completed_at is null and deadline_at <= clock_timestamp() and version = 'knowledge-a-v1';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.finish_expired_chess_assessments(jsonb) from public, anon, authenticated;
grant execute on function public.finish_expired_chess_assessments(jsonb) to service_role;
