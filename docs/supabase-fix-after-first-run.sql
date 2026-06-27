-- The Chess Academy Quest Board
-- Safe Supabase fix script after docs/supabase-schema.sql has already been run.
--
-- Use this file if you already ran the first schema once and want to apply
-- follow-up fixes without dropping tables or deleting data.
--
-- This script is intentionally additive and repair-focused:
-- - no DROP TABLE
-- - no DELETE
-- - no TRUNCATE
-- - columns are added with ADD COLUMN IF NOT EXISTS
-- - indexes are created with CREATE INDEX IF NOT EXISTS
-- - triggers and policies are safely recreated

-- 1. Extension and shared updated_at helper.
-- gen_random_uuid() is used by the uuid primary keys.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Make sure expected columns exist.
-- These ALTER statements do not remove or overwrite existing data.
-- They assume docs/supabase-schema.sql was already run once, so the tables exist.

alter table public.students add column if not exists id uuid default gen_random_uuid();
alter table public.students add column if not exists display_name text;
alter table public.students add column if not exists public_slug text;
alter table public.students add column if not exists avatar_url text;
alter table public.students add column if not exists class_group text;
alter table public.students add column if not exists total_xp integer default 0;
alter table public.students add column if not exists level integer default 1;
alter table public.students add column if not exists is_active boolean default true;
alter table public.students add column if not exists created_at timestamptz default now();
alter table public.students add column if not exists updated_at timestamptz default now();

alter table public.badges add column if not exists id uuid default gen_random_uuid();
alter table public.badges add column if not exists name text;
alter table public.badges add column if not exists description text;
alter table public.badges add column if not exists category text;
alter table public.badges add column if not exists tier text;
alter table public.badges add column if not exists xp_value integer default 0;
alter table public.badges add column if not exists unlock_requirement text;
alter table public.badges add column if not exists visual_theme text;
alter table public.badges add column if not exists art_image_url text;
alter table public.badges add column if not exists final_image_url text;
alter table public.badges add column if not exists generation_status text default 'not_generated';
alter table public.badges add column if not exists generation_error text;
alter table public.badges add column if not exists created_at timestamptz default now();
alter table public.badges add column if not exists updated_at timestamptz default now();

alter table public.student_badges add column if not exists id uuid default gen_random_uuid();
alter table public.student_badges add column if not exists student_id uuid;
alter table public.student_badges add column if not exists badge_id uuid;
alter table public.student_badges add column if not exists awarded_at timestamptz default now();
alter table public.student_badges add column if not exists note text;

alter table public.xp_events add column if not exists id uuid default gen_random_uuid();
alter table public.xp_events add column if not exists student_id uuid;
alter table public.xp_events add column if not exists amount integer;
alter table public.xp_events add column if not exists reason text;
alter table public.xp_events add column if not exists created_at timestamptz default now();

alter table public.quests add column if not exists id uuid default gen_random_uuid();
alter table public.quests add column if not exists title text;
alter table public.quests add column if not exists description text;
alter table public.quests add column if not exists quest_type text;
alter table public.quests add column if not exists xp_reward integer default 0;
alter table public.quests add column if not exists badge_reward_id uuid;
alter table public.quests add column if not exists is_active boolean default true;
alter table public.quests add column if not exists starts_at timestamptz;
alter table public.quests add column if not exists ends_at timestamptz;
alter table public.quests add column if not exists created_at timestamptz default now();
alter table public.quests add column if not exists updated_at timestamptz default now();

alter table public.student_quests add column if not exists id uuid default gen_random_uuid();
alter table public.student_quests add column if not exists student_id uuid;
alter table public.student_quests add column if not exists quest_id uuid;
alter table public.student_quests add column if not exists status text default 'not_started';
alter table public.student_quests add column if not exists completed_at timestamptz;
alter table public.student_quests add column if not exists created_at timestamptz default now();

alter table public.activity_events add column if not exists id uuid default gen_random_uuid();
alter table public.activity_events add column if not exists student_id uuid;
alter table public.activity_events add column if not exists event_type text;
alter table public.activity_events add column if not exists title text;
alter table public.activity_events add column if not exists description text;
alter table public.activity_events add column if not exists created_at timestamptz default now();

alter table public.badge_generation_jobs add column if not exists id uuid default gen_random_uuid();
alter table public.badge_generation_jobs add column if not exists badge_id uuid;
alter table public.badge_generation_jobs add column if not exists provider text default 'openai';
alter table public.badge_generation_jobs add column if not exists prompt text;
alter table public.badge_generation_jobs add column if not exists status text default 'pending';
alter table public.badge_generation_jobs add column if not exists result_image_urls jsonb default '[]'::jsonb;
alter table public.badge_generation_jobs add column if not exists selected_image_url text;
alter table public.badge_generation_jobs add column if not exists error_message text;
alter table public.badge_generation_jobs add column if not exists created_at timestamptz default now();
alter table public.badge_generation_jobs add column if not exists completed_at timestamptz;

-- 3. Make sure helpful defaults are present.
-- Existing row values are not changed here.
alter table public.students alter column id set default gen_random_uuid();
alter table public.students alter column total_xp set default 0;
alter table public.students alter column level set default 1;
alter table public.students alter column is_active set default true;
alter table public.students alter column created_at set default now();
alter table public.students alter column updated_at set default now();

alter table public.badges alter column id set default gen_random_uuid();
alter table public.badges alter column xp_value set default 0;
alter table public.badges alter column generation_status set default 'not_generated';
alter table public.badges alter column created_at set default now();
alter table public.badges alter column updated_at set default now();

alter table public.student_badges alter column id set default gen_random_uuid();
alter table public.student_badges alter column awarded_at set default now();

alter table public.xp_events alter column id set default gen_random_uuid();
alter table public.xp_events alter column created_at set default now();

alter table public.quests alter column id set default gen_random_uuid();
alter table public.quests alter column xp_reward set default 0;
alter table public.quests alter column is_active set default true;
alter table public.quests alter column created_at set default now();
alter table public.quests alter column updated_at set default now();

alter table public.student_quests alter column id set default gen_random_uuid();
alter table public.student_quests alter column status set default 'not_started';
alter table public.student_quests alter column created_at set default now();

alter table public.activity_events alter column id set default gen_random_uuid();
alter table public.activity_events alter column created_at set default now();

alter table public.badge_generation_jobs alter column id set default gen_random_uuid();
alter table public.badge_generation_jobs alter column provider set default 'openai';
alter table public.badge_generation_jobs alter column status set default 'pending';
alter table public.badge_generation_jobs alter column result_image_urls set default '[]'::jsonb;
alter table public.badge_generation_jobs alter column created_at set default now();

-- 4. Add data-quality constraints if they are missing.
-- NOT VALID keeps this safe if old test rows do not match a rule yet.
-- New rows still have to follow these checks.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'students_total_xp_nonnegative'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_total_xp_nonnegative check (total_xp >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'students_level_positive'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_level_positive check (level >= 1) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_tier_valid'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges
      add constraint badges_tier_valid check (tier in ('C', 'B', 'A', 'S')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_category_valid'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges
      add constraint badges_category_valid check (
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
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_xp_value_nonnegative'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges
      add constraint badges_xp_value_nonnegative check (xp_value >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'quests_xp_reward_nonnegative'
      and conrelid = 'public.quests'::regclass
  ) then
    alter table public.quests
      add constraint quests_xp_reward_nonnegative check (xp_reward >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_quests_status_valid'
      and conrelid = 'public.student_quests'::regclass
  ) then
    alter table public.student_quests
      add constraint student_quests_status_valid check (status in ('not_started', 'in_progress', 'completed')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badge_generation_jobs_status_valid'
      and conrelid = 'public.badge_generation_jobs'::regclass
  ) then
    alter table public.badge_generation_jobs
      add constraint badge_generation_jobs_status_valid check (status in ('pending', 'running', 'completed', 'failed')) not valid;
  end if;
end;
$$;

-- 5. Indexes for common app queries.
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

-- 6. updated_at triggers.
-- These are safe to recreate and do not change data until future updates happen.
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

-- 7. Row Level Security.
-- Public users can read safe progress data, but cannot write data.
-- The service role key can manage data later from server-side code.
alter table public.students enable row level security;
alter table public.badges enable row level security;
alter table public.student_badges enable row level security;
alter table public.xp_events enable row level security;
alter table public.quests enable row level security;
alter table public.student_quests enable row level security;
alter table public.activity_events enable row level security;
alter table public.badge_generation_jobs enable row level security;

-- 8. Recreate starter public read policies.
-- Dropping and recreating keeps the policy definitions consistent.
drop policy if exists "Public can read active students" on public.students;
drop policy if exists "Public can read badges" on public.badges;
drop policy if exists "Public can read active student badges" on public.student_badges;
drop policy if exists "Public can read active student xp events" on public.xp_events;
drop policy if exists "Public can read active quests" on public.quests;
drop policy if exists "Public can read active student quests" on public.student_quests;
drop policy if exists "Public can read active student activity events" on public.activity_events;

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

-- 9. badge_generation_jobs remains private.
-- No public read or write policy is created for this table.
