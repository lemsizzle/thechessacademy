-- Award Academy web puzzles and games at the same activity rates used for
-- equivalent Lichess activity. XP events remain the source of truth; the
-- existing XP-event trigger mirrors every positive award into Academy Coins.

create table if not exists public.academy_activity_rewards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  xp_amount integer not null,
  xp_event_id uuid unique references public.xp_events(id) on delete set null,
  activity_event_id uuid unique references public.activity_events(id) on delete set null,
  awarded_at timestamptz not null default now(),
  constraint academy_activity_rewards_source_valid
    check (source_type in ('web_puzzle', 'web_game')),
  constraint academy_activity_rewards_xp_positive check (xp_amount > 0),
  constraint academy_activity_rewards_source_unique unique (student_id, source_type, source_id)
);

create index if not exists academy_activity_rewards_student_awarded_idx
  on public.academy_activity_rewards(student_id, awarded_at desc);

alter table public.academy_activity_rewards enable row level security;
revoke all on table public.academy_activity_rewards from public, anon, authenticated;
grant select on table public.academy_activity_rewards to service_role;

drop policy if exists "Academy activity rewards are server-only" on public.academy_activity_rewards;
create policy "Academy activity rewards are server-only"
on public.academy_activity_rewards for all to anon, authenticated
using (false) with check (false);

create or replace function public.record_academy_activity_reward(
  p_student_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_xp_amount integer,
  p_reason text,
  p_title text,
  p_description text,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward_id uuid;
  v_xp_event_id uuid;
  v_activity_event_id uuid;
begin
  insert into public.academy_activity_rewards (
    student_id, source_type, source_id, xp_amount, awarded_at
  ) values (
    p_student_id, p_source_type, p_source_id, p_xp_amount, coalesce(p_created_at, now())
  )
  on conflict (student_id, source_type, source_id) do nothing
  returning id into v_reward_id;

  -- The durable source key makes replayed requests and trigger retries safe.
  if v_reward_id is null then
    return;
  end if;

  insert into public.xp_events (student_id, amount, reason, created_at)
  values (p_student_id, p_xp_amount, p_reason, coalesce(p_created_at, now()))
  returning id into v_xp_event_id;

  insert into public.activity_events (student_id, event_type, title, description, created_at)
  values (
    p_student_id,
    case when p_source_type = 'web_puzzle' then 'academy_puzzle_reward' else 'academy_game_reward' end,
    p_title,
    p_description,
    coalesce(p_created_at, now())
  )
  returning id into v_activity_event_id;

  update public.academy_activity_rewards
  set xp_event_id = v_xp_event_id,
      activity_event_id = v_activity_event_id
  where id = v_reward_id;
end;
$$;

revoke all on function public.record_academy_activity_reward(uuid, text, uuid, integer, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.award_completed_academy_puzzle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_name text;
  v_mode_name text;
begin
  if not new.solved
     or new.training_mode = 'daily'
     or (tg_op = 'UPDATE' and old.solved) then
    return new;
  end if;

  select display_name into v_student_name
  from public.students
  where id = new.student_id;

  v_mode_name := initcap(replace(new.training_mode, '_', ' '));
  perform public.record_academy_activity_reward(
    new.student_id,
    'web_puzzle',
    new.id,
    2,
    'Academy puzzle solved (' || v_mode_name || ').',
    coalesce(v_student_name, 'A student') || ' solved an Academy puzzle',
    coalesce(v_student_name, 'A student') || ' earned 2 XP and 2 coins in ' || v_mode_name || ' mode.',
    coalesce(new.completed_at, new.attempted_at, now())
  );
  return new;
end;
$$;

revoke all on function public.award_completed_academy_puzzle()
  from public, anon, authenticated, service_role;

drop trigger if exists award_completed_academy_puzzle_after_write on public.student_puzzle_attempts;
create trigger award_completed_academy_puzzle_after_write
after insert or update of solved on public.student_puzzle_attempts
for each row
execute function public.award_completed_academy_puzzle();

create or replace function public.award_completed_academy_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_ms bigint;
  v_increment_ms bigint;
  v_estimated_seconds numeric;
  v_speed text;
  v_xp integer;
  v_student_name text;
  v_result_verb text;
begin
  v_initial_ms := nullif(new.time_control ->> 'initialMs', '')::bigint;
  v_increment_ms := coalesce(nullif(new.time_control ->> 'incrementMs', '')::bigint, 0);
  v_estimated_seconds := case
    when v_initial_ms is null then null
    else (v_initial_ms + (40 * v_increment_ms)) / 1000.0
  end;

  -- Academy currently offers rapid clocks. Future clocks up to 8 minutes use
  -- the existing Lichess blitz rate; untimed games use the rapid rate.
  v_speed := case
    when v_estimated_seconds is not null and v_estimated_seconds <= 479 then 'blitz'
    else 'rapid'
  end;
  v_xp := case
    when v_speed = 'blitz' and new.result = 'win' then 5
    when v_speed = 'blitz' then 2
    when new.result = 'win' then 10
    else 5
  end;
  v_result_verb := case new.result when 'win' then 'won' when 'draw' then 'drew' else 'completed' end;

  select display_name into v_student_name
  from public.students
  where id = new.player_id;

  perform public.record_academy_activity_reward(
    new.player_id,
    'web_game',
    new.id,
    v_xp,
    'Academy ' || v_speed || ' game ' || new.result || '.',
    coalesce(v_student_name, 'A student') || ' ' || v_result_verb || ' an Academy game',
    coalesce(v_student_name, 'A student') || ' earned ' || v_xp::text || ' XP and ' || v_xp::text || ' coins for an Academy ' || v_speed || ' game.',
    coalesce(new.completed_at, now())
  );
  return new;
end;
$$;

revoke all on function public.award_completed_academy_game()
  from public, anon, authenticated, service_role;

drop trigger if exists award_completed_academy_game_after_insert on public.internal_chess_games;
create trigger award_completed_academy_game_after_insert
after insert on public.internal_chess_games
for each row
execute function public.award_completed_academy_game();

-- Keep the daily puzzle's special 10-point award while logging it in the same
-- public activity stream as every other Academy puzzle.
create or replace function public.award_daily_puzzle(
  p_student_id uuid,
  p_puzzle_id uuid,
  p_puzzle_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reward_id uuid;
  v_xp_event_id uuid;
  v_activity_event_id uuid;
  v_student_name text;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if p_puzzle_date is distinct from v_today then
    raise exception 'Daily puzzle rewards are only available on the puzzle date.';
  end if;
  if not exists (
    select 1 from public.daily_chess_puzzles
    where puzzle_date = p_puzzle_date and puzzle_id = p_puzzle_id
  ) then
    raise exception 'Puzzle does not match the daily puzzle assignment.';
  end if;

  insert into public.student_daily_puzzle_rewards (student_id, puzzle_date, puzzle_id)
  values (p_student_id, p_puzzle_date, p_puzzle_id)
  on conflict (student_id, puzzle_date) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return jsonb_build_object('awarded', false, 'xpAwarded', 0, 'coinsAwarded', 0);
  end if;

  insert into public.xp_events (student_id, amount, reason)
  values (p_student_id, 10, 'Puzzle of the Day — ' || p_puzzle_date::text)
  returning id into v_xp_event_id;

  select display_name into v_student_name from public.students where id = p_student_id;
  insert into public.activity_events (student_id, event_type, title, description)
  values (
    p_student_id,
    'academy_puzzle_reward',
    coalesce(v_student_name, 'A student') || ' solved Puzzle of the Day',
    coalesce(v_student_name, 'A student') || ' earned 10 XP and 10 coins.'
  )
  returning id into v_activity_event_id;

  update public.student_daily_puzzle_rewards
  set xp_event_id = v_xp_event_id
  where id = v_reward_id;

  return jsonb_build_object('awarded', true, 'xpAwarded', 10, 'coinsAwarded', 10, 'activityEventId', v_activity_event_id);
end;
$$;

revoke all on function public.award_daily_puzzle(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.award_daily_puzzle(uuid, uuid, date) to service_role;

comment on table public.academy_activity_rewards is
  'Idempotent XP/coin reward ledger for completed Academy web puzzles and games.';
