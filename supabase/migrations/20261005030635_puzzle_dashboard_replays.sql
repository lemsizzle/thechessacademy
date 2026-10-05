-- Practice-only results: no XP, coins, quest, or attempt triggers attach here.
create table public.student_puzzle_replays (
  student_id uuid not null references public.students(id) on delete cascade,
  puzzle_id uuid not null references public.chess_puzzles(id) on delete cascade,
  cleared_at timestamptz not null default now(),
  primary key (student_id, puzzle_id)
);

comment on table public.student_puzzle_replays is
  'Latest clean dashboard replay per student/puzzle. Original training attempts remain unchanged.';

alter table public.student_puzzle_replays enable row level security;
revoke all on table public.student_puzzle_replays from public, anon, authenticated;
grant select, insert, update, delete on table public.student_puzzle_replays to service_role;

-- The primary key serves student-scoped reads; this covers puzzle deletion/FK checks.
create index student_puzzle_replays_puzzle_idx on public.student_puzzle_replays (puzzle_id);
