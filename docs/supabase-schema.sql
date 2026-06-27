-- The Chess Academy Quest Board
-- Supabase database schema
--
-- Run this file first in a fresh Supabase SQL Editor.
-- It creates the database tables, useful indexes, updated_at triggers,
-- and starter Row Level Security policies.

-- gen_random_uuid() is provided by pgcrypto.
create extension if not exists pgcrypto;

-- Keep updated_at fresh whenever a row is edited.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Students are public-facing progress profiles.
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  public_slug text unique not null,
  avatar_url text,
  class_group text,
  total_xp integer default 0,
  level integer default 1,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Badges are collectible achievements.
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null,
  tier text not null,
  xp_value integer default 0,
  unlock_requirement text,
  visual_theme text,
  art_image_url text,
  final_image_url text,
  generation_status text default 'not_generated',
  generation_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Join table for earned badges.
create table if not exists public.student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  badge_id uuid references public.badges(id) on delete cascade,
  awarded_at timestamptz default now(),
  note text,
  unique(student_id, badge_id)
);

-- XP history for each student.
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz default now()
);

-- Quests are classroom or app challenges.
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  quest_type text not null,
  xp_reward integer default 0,
  badge_reward_id uuid references public.badges(id) on delete set null,
  is_active boolean default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quest progress per student.
create table if not exists public.student_quests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  quest_id uuid references public.quests(id) on delete cascade,
  status text default 'not_started',
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(student_id, quest_id)
);

-- Activity feed events shown in the app.
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  created_at timestamptz default now()
);

-- Server-side AI badge art generation jobs.
-- This table should remain private because prompts/errors may contain admin-only details.
create table if not exists public.badge_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid references public.badges(id) on delete cascade,
  provider text default 'openai',
  prompt text not null,
  status text default 'pending',
  result_image_urls jsonb default '[]'::jsonb,
  selected_image_url text,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Beginner-friendly constraints for app data quality.
-- The checks below avoid duplicate-constraint errors if this file is rerun.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'students_total_xp_nonnegative'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students add constraint students_total_xp_nonnegative check (total_xp >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'students_level_positive'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students add constraint students_level_positive check (level >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_tier_valid'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges add constraint badges_tier_valid check (tier in ('C', 'B', 'A', 'S'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_category_valid'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges add constraint badges_category_valid check (
      category in (
        'Tactics',
        'Checkmates',
        'Openings',
        'Endgames',
        'Tournament',
        'Sportsmanship',
        'Creativity',
        'Boss Achievements'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_xp_value_nonnegative'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges add constraint badges_xp_value_nonnegative check (xp_value >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'quests_xp_reward_nonnegative'
      and conrelid = 'public.quests'::regclass
  ) then
    alter table public.quests add constraint quests_xp_reward_nonnegative check (xp_reward >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_quests_status_valid'
      and conrelid = 'public.student_quests'::regclass
  ) then
    alter table public.student_quests add constraint student_quests_status_valid check (status in ('not_started', 'in_progress', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badge_generation_jobs_status_valid'
      and conrelid = 'public.badge_generation_jobs'::regclass
  ) then
    alter table public.badge_generation_jobs add constraint badge_generation_jobs_status_valid check (status in ('pending', 'running', 'completed', 'failed'));
  end if;
end;
$$;

-- Indexes for common app queries.
create index if not exists students_public_slug_idx on public.students(public_slug);
create index if not exists students_class_group_idx on public.students(class_group);
create index if not exists students_active_idx on public.students(is_active);
create index if not exists students_total_xp_idx on public.students(total_xp desc);

create index if not exists badges_category_idx on public.badges(category);
create index if not exists badges_tier_idx on public.badges(tier);
create index if not exists badges_generation_status_idx on public.badges(generation_status);

create index if not exists student_badges_student_id_idx on public.student_badges(student_id);
create index if not exists student_badges_badge_id_idx on public.student_badges(badge_id);

create index if not exists xp_events_student_id_created_at_idx on public.xp_events(student_id, created_at desc);

create index if not exists quests_active_idx on public.quests(is_active);
create index if not exists quests_type_idx on public.quests(quest_type);
create index if not exists quests_starts_at_idx on public.quests(starts_at);

create index if not exists student_quests_student_id_idx on public.student_quests(student_id);
create index if not exists student_quests_quest_id_idx on public.student_quests(quest_id);
create index if not exists student_quests_status_idx on public.student_quests(status);

create index if not exists activity_events_student_id_created_at_idx on public.activity_events(student_id, created_at desc);
create index if not exists activity_events_type_idx on public.activity_events(event_type);

create index if not exists badge_generation_jobs_badge_id_idx on public.badge_generation_jobs(badge_id);
create index if not exists badge_generation_jobs_status_idx on public.badge_generation_jobs(status);

-- updated_at triggers.
drop trigger if exists set_students_updated_at on public.students;
create trigger set_students_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists set_badges_updated_at on public.badges;
create trigger set_badges_updated_at
before update on public.badges
for each row execute function public.set_updated_at();

drop trigger if exists set_quests_updated_at on public.quests;
create trigger set_quests_updated_at
before update on public.quests
for each row execute function public.set_updated_at();

-- Row Level Security.
alter table public.students enable row level security;
alter table public.badges enable row level security;
alter table public.student_badges enable row level security;
alter table public.xp_events enable row level security;
alter table public.quests enable row level security;
alter table public.student_quests enable row level security;
alter table public.activity_events enable row level security;
alter table public.badge_generation_jobs enable row level security;

-- Remove old starter policies if this file is rerun.
drop policy if exists "Public can read active students" on public.students;
drop policy if exists "Public can read badges" on public.badges;
drop policy if exists "Public can read active student badges" on public.student_badges;
drop policy if exists "Public can read active student xp events" on public.xp_events;
drop policy if exists "Public can read active quests" on public.quests;
drop policy if exists "Public can read active student quests" on public.student_quests;
drop policy if exists "Public can read active student activity events" on public.activity_events;

-- Public read policies for the student/parent-facing app.
-- No insert/update/delete policies are created for public users.
-- Server-side admin code can manage data later using SUPABASE_SERVICE_ROLE_KEY.
create policy "Public can read active students"
on public.students
for select
to anon, authenticated
using (is_active = true);

create policy "Public can read badges"
on public.badges
for select
to anon, authenticated
using (true);

create policy "Public can read active student badges"
on public.student_badges
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.students
    where students.id = student_badges.student_id
      and students.is_active = true
  )
);

create policy "Public can read active student xp events"
on public.xp_events
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.students
    where students.id = xp_events.student_id
      and students.is_active = true
  )
);

create policy "Public can read active quests"
on public.quests
for select
to anon, authenticated
using (is_active = true);

create policy "Public can read active student quests"
on public.student_quests
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.students
    where students.id = student_quests.student_id
      and students.is_active = true
  )
  and exists (
    select 1
    from public.quests
    where quests.id = student_quests.quest_id
      and quests.is_active = true
  )
);

create policy "Public can read active student activity events"
on public.activity_events
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.students
    where students.id = activity_events.student_id
      and students.is_active = true
  )
);

-- badge_generation_jobs intentionally has no public policies.
-- It remains restricted unless read/write policies are added later for admin-only flows.
