alter table public.internal_chess_games
  add column if not exists takeback_count smallint not null default 0;

alter table public.internal_chess_games
  drop constraint if exists internal_chess_games_takeback_count_valid;

alter table public.internal_chess_games
  add constraint internal_chess_games_takeback_count_valid
  check (takeback_count >= 0 and takeback_count <= 1000);

comment on column public.internal_chess_games.takeback_count is
  'Number of successful takeback actions used during a saved computer game. Games with takebacks are ineligible for computer-win quests.';
