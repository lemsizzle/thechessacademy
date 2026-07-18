-- Explicitly document and enforce that puzzle answers and attempts are
-- available only through authenticated Chess Academy server routes.

revoke all on table public.chess_puzzles from anon, authenticated, service_role;
revoke all on table public.student_puzzle_attempts from anon, authenticated, service_role;

grant select, insert, update, delete on table public.chess_puzzles to service_role;
grant select, insert, update, delete on table public.student_puzzle_attempts to service_role;

drop policy if exists "Puzzle catalog is server-only" on public.chess_puzzles;
create policy "Puzzle catalog is server-only"
on public.chess_puzzles for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Puzzle attempts are server-only" on public.student_puzzle_attempts;
create policy "Puzzle attempts are server-only"
on public.student_puzzle_attempts for all to anon, authenticated
using (false) with check (false);
