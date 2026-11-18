-- Server-verified checkmate; assistance and rewards survive retries and reloads.
create table public.student_endgame_attempts (
  student_id uuid not null references public.students(id) on delete cascade,
  attempt_id uuid not null,
  topic_id text not null check (length(topic_id) between 1 and 60),
  assisted boolean not null default false,
  completed boolean not null default false,
  reward_xp integer not null default 0 check (reward_xp in (0,3)),
  created_at timestamptz not null default now(),
  primary key (student_id, attempt_id)
);
alter table public.student_endgame_attempts enable row level security;
revoke all on public.student_endgame_attempts from public, anon, authenticated;
grant select, insert, update on public.student_endgame_attempts to service_role;

create function public.save_endgame_training_reward(
  p_student_id uuid, p_attempt_id uuid, p_topic_id text, p_complete boolean, p_assisted boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  attempt public.student_endgame_attempts%rowtype;
  earned boolean := false;
begin
  if p_complete is null or p_assisted is null then raise exception 'Invalid practice state'; end if;
  if not exists(select 1 from public.students where id=p_student_id and is_active) then
    raise exception 'An active student is required';
  end if;
  insert into public.student_endgame_attempts(student_id,attempt_id,topic_id)
    values(p_student_id,p_attempt_id,p_topic_id) on conflict do nothing;
  select * into strict attempt from public.student_endgame_attempts
    where student_id=p_student_id and attempt_id=p_attempt_id for update;
  if attempt.topic_id <> p_topic_id then raise exception 'Practice session mismatch'; end if;
  attempt.assisted := attempt.assisted or p_assisted;
  if p_complete and not attempt.completed and not attempt.assisted then
    update public.students set total_xp=coalesce(total_xp,0)+3 where id=p_student_id and is_active;
    if not found then raise exception 'An active student is required'; end if;
    -- The existing XP-event trigger awards the matching 3 coins atomically.
    insert into public.xp_events(student_id,amount,reason)
      values(p_student_id,3,'Endgame Practice: '||p_topic_id||', attempt '||p_attempt_id);
    attempt.reward_xp := 3;
    earned := true;
  end if;
  update public.student_endgame_attempts set assisted=attempt.assisted,
    completed=completed or p_complete, reward_xp=attempt.reward_xp
    where student_id=p_student_id and attempt_id=p_attempt_id;
  return jsonb_build_object('rewardXp',attempt.reward_xp,'awarded',earned,'assisted',attempt.assisted);
end;
$$;
revoke all on function public.save_endgame_training_reward(uuid,uuid,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.save_endgame_training_reward(uuid,uuid,text,boolean,boolean) to service_role;
