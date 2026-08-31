alter table public.student_hide_and_seek_attempts
  add column if not exists mode text not null default 'classic';

alter table public.student_hide_and_seek_attempts
  drop constraint if exists student_hide_and_seek_mode_valid;

alter table public.student_hide_and_seek_attempts
  add constraint student_hide_and_seek_mode_valid
  check (mode in ('classic', 'time_trial'));

alter table public.student_hide_and_seek_attempts
  drop constraint if exists student_hide_and_seek_selected_squares_valid;

alter table public.student_hide_and_seek_attempts
  add constraint student_hide_and_seek_selected_squares_valid
  check (cardinality(selected_squares) between 0 and 56);

comment on column public.student_hide_and_seek_attempts.mode is
  'Hide and Seek ruleset used for this attempt: classic or time_trial.';
