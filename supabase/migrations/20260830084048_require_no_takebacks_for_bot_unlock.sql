-- Remove unlocks earned with a takeback under the original progression trigger.
-- A missing source game cannot prove eligibility and is removed as well.
delete from public.student_bot_defeats
where source_game_id is null
  or source_game_id in (
    select id
    from public.internal_chess_games
    where takeback_count > 0
  );

create or replace function public.record_student_bot_defeat()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.opponent_type = 'computer'
    and new.result = 'win'
    and coalesce(new.takeback_count, 0) = 0
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

comment on table public.student_bot_defeats is
  'Server-only bot progression recorded from verified takeback-free computer wins after the progression reset.';
