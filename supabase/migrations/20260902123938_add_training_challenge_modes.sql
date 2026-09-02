alter table public.student_star_wars_runs
  add column if not exists mode text not null default 'classic',
  add column if not exists time_limit_ms integer,
  add column if not exists started_at timestamptz not null default now();

alter table public.student_star_wars_runs
  drop constraint if exists student_star_wars_runs_mode_check,
  drop constraint if exists student_star_wars_runs_time_limit_check;

alter table public.student_star_wars_runs
  add constraint student_star_wars_runs_mode_check
    check (mode in ('classic', 'time_trial')),
  add constraint student_star_wars_runs_time_limit_check
    check (
      (mode = 'classic' and time_limit_ms is null)
      or (mode = 'time_trial' and time_limit_ms in (60000, 180000, 300000))
    );

comment on column public.student_star_wars_runs.mode is
  'Classic has no clock; time_trial uses one of the supported countdowns.';
comment on column public.student_star_wars_runs.time_limit_ms is
  'Server-authoritative Star Wars countdown duration in milliseconds.';

alter table public.student_hide_and_seek_attempts
  drop constraint if exists student_hide_and_seek_mode_valid,
  drop constraint if exists student_hide_and_seek_attempts_mode_check;

alter table public.student_hide_and_seek_attempts
  add constraint student_hide_and_seek_attempts_mode_check
    check (mode in ('classic', 'time_trial', 'hard'));

comment on column public.student_hide_and_seek_attempts.mode is
  'Classic, 60-second time trial, or one-strike hard mode.';
