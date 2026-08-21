create index if not exists chess_guided_attempts_chapter_idx
  on public.chess_guided_exercise_attempts(chapter_id);

create index if not exists chess_puzzles_source_chapter_idx
  on public.chess_puzzles(source_chapter_id)
  where source_kind = 'study' and source_chapter_id is not null;
