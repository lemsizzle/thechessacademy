-- Pin one server-only Lichess puzzle per Academy day and award its XP once.
-- Students authenticate through the app's custom Lichess session, so all
-- access remains behind service-role route handlers.

create table public.daily_chess_puzzles (
  puzzle_date date primary key,
  puzzle_id uuid not null references public.chess_puzzles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (puzzle_date, puzzle_id)
);

create index daily_chess_puzzles_puzzle_id_idx
on public.daily_chess_puzzles(puzzle_id);

create table public.student_daily_puzzle_rewards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  puzzle_date date not null,
  puzzle_id uuid not null,
  xp_event_id uuid unique references public.xp_events(id) on delete set null,
  rewarded_at timestamptz not null default now(),
  constraint student_daily_puzzle_rewards_student_date_key unique (student_id, puzzle_date),
  constraint student_daily_puzzle_rewards_daily_puzzle_fkey
    foreign key (puzzle_date, puzzle_id)
    references public.daily_chess_puzzles(puzzle_date, puzzle_id)
    on delete restrict
);

create index student_daily_puzzle_rewards_puzzle_id_idx
on public.student_daily_puzzle_rewards(puzzle_id);

alter table public.daily_chess_puzzles enable row level security;
alter table public.student_daily_puzzle_rewards enable row level security;

revoke all on table public.daily_chess_puzzles from anon, authenticated;
revoke all on table public.student_daily_puzzle_rewards from anon, authenticated;
grant select, insert on table public.daily_chess_puzzles to service_role;
grant select, insert, update on table public.student_daily_puzzle_rewards to service_role;

create policy "Daily puzzle assignments are server-only"
on public.daily_chess_puzzles
for all to anon, authenticated
using (false)
with check (false);

create policy "Daily puzzle rewards are server-only"
on public.student_daily_puzzle_rewards
for all to anon, authenticated
using (false)
with check (false);

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
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if p_puzzle_date is distinct from v_today then
    raise exception 'Daily puzzle rewards are only available on the puzzle date.';
  end if;

  if not exists (
    select 1
    from public.daily_chess_puzzles
    where puzzle_date = p_puzzle_date
      and puzzle_id = p_puzzle_id
  ) then
    raise exception 'Puzzle does not match the daily puzzle assignment.';
  end if;

  insert into public.student_daily_puzzle_rewards (
    student_id,
    puzzle_date,
    puzzle_id
  ) values (
    p_student_id,
    p_puzzle_date,
    p_puzzle_id
  )
  on conflict (student_id, puzzle_date) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return jsonb_build_object(
      'awarded', false,
      'xpAwarded', 0,
      'coinsAwarded', 0
    );
  end if;

  insert into public.xp_events (student_id, amount, reason)
  values (
    p_student_id,
    10,
    'Puzzle of the Day — ' || p_puzzle_date::text
  )
  returning id into v_xp_event_id;

  update public.student_daily_puzzle_rewards
  set xp_event_id = v_xp_event_id
  where id = v_reward_id;

  return jsonb_build_object(
    'awarded', true,
    'xpAwarded', 10,
    'coinsAwarded', 10
  );
end;
$$;

revoke all on function public.award_daily_puzzle(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.award_daily_puzzle(uuid, uuid, date) to service_role;

alter table public.student_puzzle_attempts
drop constraint if exists student_puzzle_attempts_theme_valid;

alter table public.student_puzzle_attempts
add constraint student_puzzle_attempts_theme_valid
check (selected_theme in (
  'mixed',
  'fork',
  'pin',
  'skewer',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'backRankMate',
  'discoveredAttack',
  'doubleCheck',
  'deflection',
  'attraction',
  'clearance',
  'interference',
  'xRayAttack',
  'trappedPiece',
  'hangingPiece',
  'sacrifice',
  'advancedPawn',
  'promotion',
  'quietMove',
  'defensiveMove',
  'exposedKing',
  'kingsideAttack'
));

comment on table public.daily_chess_puzzles is 'One immutable server-selected Lichess puzzle for each Asia/Bangkok Academy day.';
comment on table public.student_daily_puzzle_rewards is 'Idempotent Puzzle of the Day XP and coin awards.';
