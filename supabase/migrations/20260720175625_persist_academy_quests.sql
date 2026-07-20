-- Shared quest definitions used by every browser and device.
-- Quest ids are text because existing Lichess progress rows already use stable
-- ids such as "lichess-puzzle-machine" and "local-quest-1782629596797".
create table if not exists public.academy_quests (
  id text primary key,
  title text not null,
  description text not null default '',
  type text not null default 'weekly',
  status text not null default 'available',
  is_live boolean not null default false,
  xp_reward integer not null default 0,
  badge_reward_id text,
  completion_url text,
  class_group text,
  category text,
  source text,
  condition_type text,
  time_window text,
  required_count integer,
  required_score integer,
  required_accuracy integer,
  required_theme text,
  approval_required boolean not null default true,
  is_active boolean not null default true,
  is_repeatable boolean not null default false,
  cooldown_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_quests_student_visibility_idx
  on public.academy_quests (is_active, is_live, created_at desc);

create index if not exists academy_quests_source_idx
  on public.academy_quests (source, condition_type);

create or replace function public.set_academy_quest_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists academy_quests_set_updated_at on public.academy_quests;
create trigger academy_quests_set_updated_at
before update on public.academy_quests
for each row execute function public.set_academy_quest_updated_at();

alter table public.academy_quests enable row level security;

revoke all on table public.academy_quests from anon, authenticated;
grant select on table public.academy_quests to anon, authenticated;

drop policy if exists "Public can read active academy quests" on public.academy_quests;
create policy "Public can read active academy quests"
on public.academy_quests
for select
to anon, authenticated
using (is_active = true);

-- Seed the shared Lichess quests. Upserts keep this migration rerunnable and
-- preserve progress because the existing quest ids do not change.
insert into public.academy_quests (
  id, title, description, type, status, is_live, xp_reward, completion_url,
  category, source, condition_type, time_window, required_count, required_score,
  approval_required, is_active, is_repeatable, cooldown_days
)
values
  ('lichess-rapid-warrior', 'Rapid Warrior', 'Win 5 rated rapid games in one day. Games under 10 moves do not count.', 'weekly', 'available', true, 150, 'https://lichess.org/', 'Lichess', 'lichess_games', 'rapid_win_count', 'daily', 5, null, true, true, true, 1),
  ('lichess-puzzle-machine', 'Puzzle Machine', 'Solve 50 Lichess puzzles in one week.', 'weekly', 'available', true, 200, 'https://lichess.org/training', 'Lichess', 'lichess_puzzles', 'puzzle_solved_count', 'weekly', 50, null, true, true, true, 7),
  ('lichess-consistent-competitor', 'Consistent Competitor', 'Play 10 rated rapid games in one week. Games under 10 moves do not count.', 'weekly', 'available', true, 100, 'https://lichess.org/', 'Lichess', 'lichess_games', 'rapid_games_played_count', 'weekly', 10, null, true, true, true, 7),
  ('lichess-perfect-puzzle-day', 'Perfect Puzzle Day', 'Attempt 20 puzzles in one day with at least 80% accuracy.', 'weekly', 'available', true, 150, 'https://lichess.org/training', 'Lichess', 'lichess_puzzles', 'puzzle_accuracy_threshold', 'daily', 20, null, true, true, true, 1),
  ('lichess-arena-grinder', 'Arena Grinder', 'Score at least 20 Arena points in one tournament.', 'boss', 'available', true, 150, 'https://lichess.org/team/outschool-battleground', 'Lichess', 'lichess_tournaments', 'arena_score_threshold', 'tournament', null, 20, true, true, true, 0),
  ('local-quest-1782629596797', 'Blitz Warrior', 'LET''S GO WARRIORS!', 'weekly', 'available', true, 100, 'https://lichess.org/', 'Lichess', 'lichess_games', 'rated_games_played_count', 'daily', 10, null, true, true, true, 1)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  type = excluded.type,
  status = excluded.status,
  is_live = excluded.is_live,
  xp_reward = excluded.xp_reward,
  completion_url = excluded.completion_url,
  category = excluded.category,
  source = excluded.source,
  condition_type = excluded.condition_type,
  time_window = excluded.time_window,
  required_count = excluded.required_count,
  required_score = excluded.required_score,
  approval_required = excluded.approval_required,
  is_active = excluded.is_active,
  is_repeatable = excluded.is_repeatable,
  cooldown_days = excluded.cooldown_days,
  updated_at = now();

-- Keep the original classroom quests available in the shared editor too.
insert into public.academy_quests (
  id, title, description, type, status, is_live, xp_reward, badge_reward_id,
  source, condition_type, approval_required, is_active, is_repeatable
)
values
  ('quest-weekly-forks', 'Weekly Quest: Fork Finder', 'Find five forks across puzzles or class games.', 'weekly', 'in-progress', true, 75, 'fork-apprentice', 'manual', 'manual', true, true, false),
  ('quest-endgame-tower', 'Weekly Quest: Endgame Tower', 'Win king and pawn, rook ladder, and opposition drills.', 'weekly', 'available', true, 110, 'endgame-survivor', 'manual', 'manual', true, true, false),
  ('quest-boss-back-rank', 'Boss Quest: Back Rank Dragon', 'Defeat the boss by spotting escape squares and final-rank mates.', 'boss', 'available', false, 180, 'back-rank-mate', 'manual', 'manual', true, true, false),
  ('quest-tournament-focus', 'Boss Quest: Tournament Trial', 'Play three focused games with notation and reflection.', 'boss', 'completed', false, 220, 'tournament-warrior', 'manual', 'manual', true, true, false)
on conflict (id) do nothing;
