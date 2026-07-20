-- Persist the Lichess account snapshot and first-login activity baseline.
-- This keeps student and teacher views consistent across browsers and Vercel functions.
create table if not exists public.student_lichess_accounts (
  student_id uuid primary key references public.students(id) on delete cascade,
  lichess_user_id text not null,
  lichess_username text not null,
  account_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_lichess_accounts_user_id_key
  on public.student_lichess_accounts(lower(lichess_user_id));

create unique index if not exists student_lichess_accounts_username_key
  on public.student_lichess_accounts(lower(lichess_username));

create index if not exists student_lichess_accounts_updated_at_idx
  on public.student_lichess_accounts(updated_at desc);

create or replace function public.set_student_lichess_account_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_lichess_accounts_updated_at on public.student_lichess_accounts;
create trigger set_student_lichess_accounts_updated_at
before update on public.student_lichess_accounts
for each row execute function public.set_student_lichess_account_updated_at();

alter table public.student_lichess_accounts enable row level security;

-- Account snapshots are private. They are accessed only by authenticated app routes
-- through the server-side Supabase service client.
revoke all on table public.student_lichess_accounts from anon, authenticated;
