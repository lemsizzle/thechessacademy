-- New private student challenges use short, shareable four-character codes.
-- Keep the legacy twelve-character shape valid so existing waiting games can
-- still be joined after this migration.

alter table public.live_chess_games
  drop constraint if exists live_chess_games_code_format;

alter table public.live_chess_games
  add constraint live_chess_games_code_format
  check (
    challenge_code ~ '^[A-Z0-9]{4}$'
    or challenge_code ~ '^[A-HJ-NP-Z2-9]{12}$'
  );
