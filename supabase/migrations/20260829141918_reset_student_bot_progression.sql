-- Bot unlocks intentionally begin empty for every current student. Historical
-- computer wins are not backfilled, so existing and future students both start
-- with only the always-available opponents defined by the application.

create table if not exists public.student_bot_defeats (
  student_id uuid not null references public.students(id) on delete cascade,
  bot_id text not null,
  source_game_id uuid references public.internal_chess_games(id) on delete set null,
  defeated_at timestamptz not null default now(),
  primary key (student_id, bot_id),
  constraint student_bot_defeats_bot_valid check (bot_id in (
    'pawny', 'knight', 'bishop', 'rook', 'queen'
  ))
);

alter table public.student_bot_defeats enable row level security;

revoke all on table public.student_bot_defeats from public, anon, authenticated, service_role;
grant select, insert on table public.student_bot_defeats to service_role;

drop policy if exists "Bot progression is server-only" on public.student_bot_defeats;
create policy "Bot progression is server-only"
on public.student_bot_defeats for all to anon, authenticated
using (false) with check (false);

create or replace function public.record_student_bot_defeat()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.opponent_type = 'computer'
    and new.result = 'win'
    and new.opponent_id in ('pawny', 'knight', 'bishop', 'rook', 'queen') then
    insert into public.student_bot_defeats (
      student_id,
      bot_id,
      source_game_id,
      defeated_at
    ) values (
      new.player_id,
      new.opponent_id,
      new.id,
      new.completed_at
    )
    on conflict (student_id, bot_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.record_student_bot_defeat() from public, anon, authenticated;
grant execute on function public.record_student_bot_defeat() to service_role;

drop trigger if exists record_student_bot_defeat_after_insert on public.internal_chess_games;
create trigger record_student_bot_defeat_after_insert
after insert on public.internal_chess_games
for each row execute function public.record_student_bot_defeat();

comment on table public.student_bot_defeats is
  'Server-only bot progression recorded from verified computer wins after the progression reset.';
