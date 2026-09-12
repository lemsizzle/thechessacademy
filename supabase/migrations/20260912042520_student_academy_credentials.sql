create table if not exists public.student_login_credentials (
  student_id uuid primary key references public.students(id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_login_username_format check (username ~ '^[a-z0-9_-]{3,24}$')
);

alter table public.student_login_credentials enable row level security;
revoke all on table public.student_login_credentials from anon, authenticated;

comment on table public.student_login_credentials is
  'Server-only academy username/password credentials for manually managed students.';
