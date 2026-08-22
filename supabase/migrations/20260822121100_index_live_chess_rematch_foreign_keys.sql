-- Cover the two Phase 11 rematch foreign keys reported by the database advisor.
create index if not exists live_chess_games_rematch_game_idx
  on public.live_chess_games(rematch_game_id)
  where rematch_game_id is not null;

create index if not exists live_chess_games_rematch_requested_by_idx
  on public.live_chess_games(rematch_requested_by)
  where rematch_requested_by is not null;
