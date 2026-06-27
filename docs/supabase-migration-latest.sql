create extension if not exists "pgcrypto";

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  lichess_username text,
  name text not null,
  avatar_url text,
  class_group text not null,
  total_xp integer not null default 0,
  encouragement text,
  source text,
  outschool_learner_id text,
  created_at timestamptz not null default now()
);

create table if not exists badges (
  id text primary key,
  name text not null,
  description text not null,
  category text not null,
  tactic_theme text,
  concept_theme text,
  tier text,
  xp_value integer not null default 0,
  unlock_requirement text not null,
  required_puzzle_count integer,
  visual_theme text not null,
  image_prompt text,
  art_image_url text,
  final_image_url text,
  generation_status text not null default 'pending',
  is_active boolean not null default true,
  is_legacy boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  badge_id text references badges(id),
  awarded_at timestamptz not null default now(),
  awarded_by uuid,
  unique (student_id, badge_id)
);

create table if not exists xp_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists quests (
  id text primary key,
  title text not null,
  description text not null,
  type text not null,
  status text not null,
  is_live boolean not null default false,
  xp_reward integer not null default 0,
  badge_reward_id text references badges(id),
  class_group text,
  created_at timestamptz not null default now()
);

create table if not exists student_quests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  quest_id text references quests(id) on delete cascade,
  status text not null default 'available',
  completed_at timestamptz,
  unique (student_id, quest_id)
);

create table if not exists resources (
  id text primary key,
  title text not null,
  description text not null,
  url text not null,
  category text not null,
  status text not null default 'inactive',
  featured boolean not null default false,
  class_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists student_tactic_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  tactic_theme text not null,
  puzzles_solved integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (student_id, tactic_theme)
);

create table if not exists pending_awards (
  id text primary key,
  student_id uuid references students(id) on delete cascade,
  source text not null,
  tactic_theme text,
  badge_id text references badges(id),
  badge_name text,
  xp_value integer not null default 0,
  puzzles_solved integer,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists lichess_connections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  lichess_username text not null,
  status text not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (student_id)
);

create table if not exists lichess_sync_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  level text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists class_groups (
  id text primary key,
  name text not null,
  outschool_class_url text,
  outschool_section_id text,
  sync_status text not null default 'not-connected',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_slug on students(slug);
create index if not exists idx_student_badges_student_id on student_badges(student_id);
create index if not exists idx_xp_events_student_id on xp_events(student_id);
create index if not exists idx_pending_awards_student_status on pending_awards(student_id, status);
create index if not exists idx_student_tactic_progress_student_id on student_tactic_progress(student_id);
create index if not exists idx_resources_status on resources(status);

create table if not exists lichess_arena_tournaments (
  id uuid primary key default gen_random_uuid(),
  lichess_id text unique not null,
  team_id text,
  name text not null,
  source text not null default 'team_sync',
  status text not null default 'unknown',
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer,
  url text not null,
  created_by text,
  rated boolean,
  variant text,
  speed text,
  time_control text,
  player_count integer,
  is_public boolean not null default true,
  raw_data jsonb,
  synced_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lichess_arena_tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references lichess_arena_tournaments(id) on delete cascade,
  lichess_tournament_id text not null,
  student_id uuid references students(id) on delete set null,
  lichess_username text not null,
  rank integer not null default 0,
  score integer not null default 0,
  rating integer,
  performance integer,
  tournament_starts_at timestamptz,
  raw_data jsonb,
  imported_at timestamptz not null default now(),
  unique (lichess_tournament_id, lichess_username)
);

create table if not exists pending_tournament_awards (
  id text primary key,
  student_id uuid references students(id) on delete cascade,
  tournament_id uuid references lichess_arena_tournaments(id) on delete cascade,
  lichess_tournament_id text not null,
  lichess_username text not null,
  title text not null,
  description text not null,
  xp_amount integer not null default 0,
  reason text not null,
  tournament_source text,
  status text not null default 'pending',
  teacher_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  unique (student_id, lichess_tournament_id)
);

create index if not exists idx_arena_results_student_id on lichess_arena_tournament_results(student_id);
create index if not exists idx_tournament_awards_student_status on pending_tournament_awards(student_id, status);

alter table lichess_arena_tournaments add column if not exists source text not null default 'team_sync';
alter table lichess_arena_tournaments add column if not exists is_public boolean not null default true;
alter table lichess_arena_tournaments add column if not exists imported_at timestamptz;
alter table lichess_arena_tournament_results add column if not exists tournament_starts_at timestamptz;
alter table pending_tournament_awards add column if not exists tournament_source text;

alter table if exists student_lichess_accounts add column if not exists peak_blitz_rating integer;
alter table if exists student_lichess_accounts add column if not exists peak_rapid_rating integer;
alter table if exists student_lichess_accounts add column if not exists peak_puzzle_rating integer;
alter table if exists student_lichess_accounts add column if not exists baseline_blitz_games integer default 0;
alter table if exists student_lichess_accounts add column if not exists baseline_rapid_games integer default 0;
alter table if exists student_lichess_accounts add column if not exists baseline_puzzle_games integer default 0;
alter table if exists student_lichess_accounts add column if not exists activity_baseline_set_at timestamptz;

alter table quests add column if not exists category text;
alter table quests add column if not exists source text;
alter table quests add column if not exists condition_type text;
alter table quests add column if not exists time_window text;
alter table quests add column if not exists required_count integer;
alter table quests add column if not exists required_score integer;
alter table quests add column if not exists required_accuracy integer;
alter table quests add column if not exists required_theme text;
alter table quests add column if not exists approval_required boolean not null default true;
alter table quests add column if not exists is_active boolean not null default true;
alter table quests add column if not exists is_repeatable boolean not null default false;
alter table quests add column if not exists cooldown_days integer not null default 0;
alter table quests add column if not exists updated_at timestamptz not null default now();

create table if not exists pending_quest_awards (
  id text primary key,
  student_id uuid references students(id) on delete cascade,
  quest_id text references quests(id) on delete cascade,
  source text not null,
  source_period_start timestamptz not null,
  source_period_end timestamptz not null,
  title text not null,
  description text not null,
  xp_amount integer not null default 0,
  badge_id text references badges(id),
  evidence text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  unique (student_id, quest_id, source_period_start)
);

create table if not exists quest_completion_events (
  id text primary key,
  student_id uuid references students(id) on delete cascade,
  quest_id text references quests(id) on delete cascade,
  award_id text references pending_quest_awards(id),
  completed_at timestamptz not null default now(),
  source text not null,
  source_period_start timestamptz not null,
  source_period_end timestamptz not null,
  xp_awarded integer not null default 0,
  badge_awarded_id text references badges(id),
  evidence text not null
);

create table if not exists lichess_activity_snapshots (
  id text primary key,
  student_id uuid references students(id) on delete cascade,
  source text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  mode text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_quest_awards_student_status on pending_quest_awards(student_id, status);
create index if not exists idx_pending_quest_awards_quest_window on pending_quest_awards(quest_id, source_period_start, source_period_end);
create index if not exists idx_quest_completion_student_quest on quest_completion_events(student_id, quest_id);
create index if not exists idx_lichess_snapshots_student_source on lichess_activity_snapshots(student_id, source, period_start);

-- Existing Swiss-related tables or columns are intentionally left in place.
-- They are deprecated and unused by the application.
