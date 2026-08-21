-- Persistent analysis studies. The application uses its existing custom
-- student/admin sessions, so all access is mediated by authenticated Next.js
-- routes using the service role. Browser database roles are denied by default.

create extension if not exists pgcrypto;

create table if not exists public.chess_studies (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null,
  owner_student_id uuid references public.students(id) on delete cascade,
  title text not null,
  description text not null default '',
  visibility text not null default 'private',
  source_game_id uuid references public.internal_chess_games(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chess_studies_owner_kind_valid check (owner_kind in ('student', 'admin')),
  constraint chess_studies_owner_valid check (
    (owner_kind = 'student' and owner_student_id is not null) or
    (owner_kind = 'admin' and owner_student_id is null)
  ),
  constraint chess_studies_title_length check (char_length(title) between 1 and 120),
  constraint chess_studies_description_length check (char_length(description) <= 2000),
  constraint chess_studies_visibility_valid check (visibility in ('private', 'shared'))
);

create table if not exists public.chess_study_members (
  study_id uuid not null references public.chess_studies(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (study_id, student_id),
  constraint chess_study_members_role_valid check (role in ('owner', 'editor', 'viewer'))
);

create table if not exists public.chess_study_chapters (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.chess_studies(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  initial_fen text not null,
  analysis_tree jsonb not null,
  source_game_id uuid references public.internal_chess_games(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chess_study_chapters_title_length check (char_length(title) between 1 and 120),
  constraint chess_study_chapters_sort_order_valid check (sort_order >= 0),
  constraint chess_study_chapters_tree_object check (jsonb_typeof(analysis_tree) = 'object'),
  constraint chess_study_chapters_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint chess_study_chapters_version_valid check (version > 0)
);

create index if not exists chess_studies_owner_updated_idx
  on public.chess_studies(owner_student_id, updated_at desc);
create index if not exists chess_studies_source_game_idx
  on public.chess_studies(source_game_id);
create index if not exists chess_study_members_student_idx
  on public.chess_study_members(student_id, study_id);
create unique index if not exists chess_study_chapters_order_idx
  on public.chess_study_chapters(study_id, sort_order);
create index if not exists chess_study_chapters_source_game_idx
  on public.chess_study_chapters(source_game_id);

alter table public.chess_studies enable row level security;
alter table public.chess_study_members enable row level security;
alter table public.chess_study_chapters enable row level security;

revoke all on table public.chess_studies from public, anon, authenticated, service_role;
revoke all on table public.chess_study_members from public, anon, authenticated, service_role;
revoke all on table public.chess_study_chapters from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.chess_studies to service_role;
grant select, insert, update, delete on table public.chess_study_members to service_role;
grant select, insert, update, delete on table public.chess_study_chapters to service_role;

drop policy if exists "Chess studies are server-only" on public.chess_studies;
create policy "Chess studies are server-only" on public.chess_studies
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "Chess study members are server-only" on public.chess_study_members;
create policy "Chess study members are server-only" on public.chess_study_members
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "Chess study chapters are server-only" on public.chess_study_chapters;
create policy "Chess study chapters are server-only" on public.chess_study_chapters
  for all to anon, authenticated using (false) with check (false);

comment on table public.chess_studies is 'Chess Academy analysis study containers owned by a student or the teacher account.';
comment on table public.chess_study_chapters is 'Atomic, versioned move-tree documents with comments, NAGs, and board shapes.';
