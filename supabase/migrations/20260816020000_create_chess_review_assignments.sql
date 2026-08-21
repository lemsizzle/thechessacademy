-- Teacher-created review tasks for an entire study or one chapter. The app's
-- custom sessions are enforced by Next.js routes; browser database roles have
-- no direct access to assignment prompts or hidden teacher answers.

create unique index if not exists chess_study_chapters_study_id_id_idx
  on public.chess_study_chapters(study_id, id);

create table if not exists public.chess_review_assignments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.chess_studies(id) on delete cascade,
  chapter_id uuid,
  student_id uuid not null references public.students(id) on delete cascade,
  prompt text not null,
  teacher_answer text not null default '',
  answer_visibility text not null default 'after_completion',
  status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint chess_review_assignments_chapter_study_fkey
    foreign key (study_id, chapter_id)
    references public.chess_study_chapters(study_id, id)
    on delete cascade,
  constraint chess_review_assignments_prompt_length
    check (char_length(prompt) between 1 and 2000),
  constraint chess_review_assignments_answer_length
    check (char_length(teacher_answer) <= 4000),
  constraint chess_review_assignments_answer_visibility_valid
    check (answer_visibility in ('visible', 'after_completion', 'teacher_only')),
  constraint chess_review_assignments_status_valid
    check (status in ('assigned', 'completed')),
  constraint chess_review_assignments_completion_consistent
    check ((status = 'completed' and completed_at is not null) or (status = 'assigned' and completed_at is null))
);

create unique index if not exists chess_review_assignments_study_student_unique
  on public.chess_review_assignments(study_id, student_id)
  where chapter_id is null;
create unique index if not exists chess_review_assignments_chapter_student_unique
  on public.chess_review_assignments(chapter_id, student_id)
  where chapter_id is not null;
create index if not exists chess_review_assignments_student_status_idx
  on public.chess_review_assignments(student_id, status, assigned_at desc);
create index if not exists chess_review_assignments_study_assigned_idx
  on public.chess_review_assignments(study_id, assigned_at desc);
create index if not exists chess_review_assignments_study_chapter_idx
  on public.chess_review_assignments(study_id, chapter_id);

alter table public.chess_review_assignments enable row level security;

revoke all on table public.chess_review_assignments from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.chess_review_assignments to service_role;

drop policy if exists "Chess review assignments are server-only" on public.chess_review_assignments;
create policy "Chess review assignments are server-only" on public.chess_review_assignments
  for all to anon, authenticated using (false) with check (false);

comment on table public.chess_review_assignments is
  'Teacher-created study or chapter review tasks with student completion and gated teacher answers.';
