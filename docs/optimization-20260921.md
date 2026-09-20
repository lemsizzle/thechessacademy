# Optimization pass — 21 September 2026

Development base revision: `82d66fd`. Existing uncommitted avatar, chess-theme, and Arena work was preserved. The measurements below were collected locally before release.

Release base revision: `c4baadf` from `origin/main`. The training page retains the current session-aware shell, login redirects, and streamed loading while deferring rankings. No earlier production updates are replaced.

## Changes

- Computer games reuse the existing move list for takeback availability instead of replaying chess.js history on every clock update. The initial chess instance is created once per mounted game hook. Position synchronization also reuses the projected move list when restoring a move after takeback.
- Game history uses the FEN already recorded by chess.js for each move instead of replaying every move a second time. This also preserves positions for custom starting FENs, castling, en passant, and underpromotion.
- The move-history component skips renders when its moves, selected position, and callback have not changed.
- The computer-game clock starts its timer only while running and stops it on pause or expiration. Finished games and untimed/setup screens no longer keep scheduling clock ticks.
- Puzzle Training fetches the leaderboard roster and avatars, and loads the leaderboard component, only when the student opens their stats. Personal progress remains available at startup. The authenticated endpoint returns private, non-cacheable responses and never substitutes mock students after a data failure. Fetches have a timeout, unmount cancellation, a retry action, and focus preservation within the stats dialog.

## Measurements

These are local controlled measurements, not production speed or frame-rate claims.

| Measurement | Before | After |
| --- | ---: | ---: |
| Project an 80-ply move history, median of 30 samples after warmup | 6.139 ms | 2.157 ms |
| History rebuilds during 1.5 seconds of active low-time clock updates | 9–14 | 0 |
| Move-history component renders during the same interval | 9–14 | 0 |
| Clock callbacks during 450 ms after resignation | 4–5 | 0 |
| Leaderboard requests before opening puzzle stats | Eager server loading | 0 client requests; roster/avatar loaders removed from page startup |

The history projection benchmark improved by approximately 65%. Active clocks continued to advance correctly during browser measurements.

## Verification

- Development checks passed: `npm run lint`, all 766 tests in 133 files (`npm test -- --reporter=dot --maxWorkers=4`), and `npm run build`.
- Release validation on the current production base passed TypeScript, all 885 tests in 150 files, and the production build. Chromium and WebKit checks were repeated at both viewport widths and passed.
- Regression tests cover history positions and undo for en passant, castling, and underpromotion; leaderboard authentication before data access; non-cacheable responses; and safe handling of backend failures and mock fallbacks.
- Chromium and WebKit passed at 390 px and 1440 px: piece interaction, active clocks, takeback and restored positions, resumed play, resignation/game-save payloads, on-demand stats loading, failure/retry, keyboard return from stats, and Survival puzzle submission.
- Browser checks use the real React components with controlled bot responses and API fixtures. They do not write production student progress or claim to verify a production deployment. The installed Playwright runtime was used because the agent-browser CLI was unavailable.
- Raw measurements, browser results, screenshots, build logs, and reproducible fixture scripts are under `work/optimization-20260921/`.

## Student cleanup

A read-only production check found 54 active profiles, zero inactive profiles, and zero profiles with an unspecified active flag. The live student table has `is_active` and no archive or last-login column. No profile qualifies under the agreed policy of archiving only profiles explicitly marked inactive. No student or related history was modified or deleted. A time-based inactivity threshold remains undefined and must not be inferred.

## Release and rollback

Release through the repository's existing GitHub/Vercel workflow after an explicit release request. No database migration is needed. Roll back this pass by reverting its release commit. Preserve unrelated working-tree changes. Do not remove old source art, backups, or other checkouts as part of this pass.
