# Puzzle Battle tournaments

Teachers open **Tournaments → Host Puzzle Battle tournament**. Choose Survival, Star Wars, or Hide and Seek, a 1/3/5/10-minute time control, and 1–9 rounds. Share the student lobby link. Up to 32 players can join, including teacher-added bots.

Teachers set each bot's name and Elo (200–2400) before starting. Elo adjusts estimated puzzle-solving speed and accuracy; it is not an independently calibrated chess rating. Student lobbies, standings, and battles use the same name presentation for all entrants, without ratings or bot labels. Teacher controls retain this information.

The roster locks at the first round. The teacher starts the tournament once. Later rounds start automatically after every battle finishes, with automatic score-based pairings that avoid repeats where possible. All matches in a round receive the same puzzle deck and a shared ten-second countdown. Odd entrants receive rotating byes. Win = 2 tournament points, draw = 1, loss = 0, bye = 2; equal totals share rank. No new XP or coin rewards are added.

Survival and Star Wars retain their existing three-life score races. Hide and Seek uses one Star Detective position: the first player to find every safe square wins, and a wrong square loses immediately. An unfinished Hide and Seek race at the time limit is a draw. Students can return to standings or stay on the result screen, which automatically opens their next assigned battle. Both views show the shared ten-second countdown.

Results persist after reload. Lobby requests settle expired battles and scheduled bot results using database time, including when players close their tabs. Authenticated lobby and finished-battle requests prepare the next round automatically. A database lease and version check prevent duplicate rounds. If every browser is closed, progression resumes on the next visit with a fresh countdown. No background chess engine or cron job is added. Lobby polling pauses in hidden tabs and stops once the tournament finishes; active lobbies refresh every ten seconds and tournament lists every thirty seconds. Existing gameplay requests remain unchanged.

## Release

Apply `supabase/migrations/20261108163105_puzzle_battle_tournaments.sql` before deploying the associated application changes. It adds service-only tournament tables and RPCs with RLS enabled. The application routes independently verify teacher or active-student sessions. The initial production migration was applied on November 8, 2026; its remote migration timestamp may differ from the local filename. Automatic rounds also require `20261108165226_puzzle_tournament_auto_rounds.sql`, applied to production on November 8, 2026.

## Verification

- `npm test`, `npm run lint`, `npm run build`
- `node --test tests/puzzle-battle/tournament-db.test.mjs`
- Start the isolated browser fixture with `BATTLE_TOURNAMENT_QA=1` and `BATTLE_PREVIEW_PORT=9498`, running `node tests/browser/puzzle-battle-server.cjs` after the build.
- Run `node tests/browser/verify-puzzle-tournaments.cjs` against that fixture. This covers teacher creation, hidden student ratings, joining, all three modes, solving, reloads, results, and authorization. The fixture uses an isolated database and synthetic accounts, not production student records.

- Automatic-round browser check: `node tests/browser/verify-puzzle-tournament-auto-rounds.cjs`. Exercises two rounds with the teacher page closed, including countdown, reload, duplicate-read protection, and stopping after the final round.
