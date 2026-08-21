create index if not exists chess_studies_source_game_idx
  on public.chess_studies(source_game_id);

create index if not exists chess_study_chapters_source_game_idx
  on public.chess_study_chapters(source_game_id);
