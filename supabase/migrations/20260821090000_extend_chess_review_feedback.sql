-- Phase 5B: add written student responses and a teacher approve/return
-- workflow without introducing realtime collaboration.

alter table public.chess_review_assignments
  add column if not exists student_response text not null default '',
  add column if not exists teacher_feedback text not null default '',
  add column if not exists reviewed_at timestamptz;

alter table public.chess_review_assignments
  drop constraint if exists chess_review_assignments_status_valid,
  drop constraint if exists chess_review_assignments_completion_consistent;

update public.chess_review_assignments
set status = 'approved',
    reviewed_at = coalesce(reviewed_at, completed_at, updated_at)
where status = 'completed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chess_review_assignments_response_length'
      and conrelid = 'public.chess_review_assignments'::regclass
  ) then
    alter table public.chess_review_assignments
      add constraint chess_review_assignments_response_length
      check (char_length(student_response) <= 4000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chess_review_assignments_feedback_length'
      and conrelid = 'public.chess_review_assignments'::regclass
  ) then
    alter table public.chess_review_assignments
      add constraint chess_review_assignments_feedback_length
      check (char_length(teacher_feedback) <= 4000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chess_review_assignments_status_valid'
      and conrelid = 'public.chess_review_assignments'::regclass
  ) then
    alter table public.chess_review_assignments
      add constraint chess_review_assignments_status_valid
      check (status in ('assigned', 'submitted', 'returned', 'approved'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chess_review_assignments_workflow_consistent'
      and conrelid = 'public.chess_review_assignments'::regclass
  ) then
    alter table public.chess_review_assignments
      add constraint chess_review_assignments_workflow_consistent
      check (
        (status = 'assigned' and completed_at is null and reviewed_at is null) or
        (status = 'submitted' and completed_at is not null and reviewed_at is null) or
        (status in ('returned', 'approved') and completed_at is not null and reviewed_at is not null)
      );
  end if;
end $$;

comment on column public.chess_review_assignments.student_response is
  'Latest written answer submitted by the assigned student.';
comment on column public.chess_review_assignments.teacher_feedback is
  'Teacher feedback shown to the assigned student after review.';
comment on column public.chess_review_assignments.reviewed_at is
  'Timestamp of the latest teacher approve or return decision.';
