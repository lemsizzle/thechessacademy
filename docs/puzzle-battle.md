# Puzzle Battle

Students open **Train → Puzzle Battle**, choose Survival, Star Wars, or Hide and Seek, and select 1, 3, 5, or 10 minutes. Create a challenge and share its code/link, or join an open challenge. The lobby lists only unexpired waiting challenges with an open seat, excluding started, finished, cancelled, and expired rooms. It no longer loads personal battle history. Joining automatically starts the shared five-second countdown; there are no Ready buttons.

In Survival and Star Wars, both players receive the same ordered deck of up to 50 boards. A fully completed board scores one point. A wrong answer or skip costs one of three lives. With no lives left, the student watches the opponent's score until that run or the clock ends. Highest score wins; equal scores draw. Leaving a started match forfeits it. Waiting challenges expire after ten minutes.

Survival requires the full puzzle continuation. Star Wars requires a complete star route, with SVG stars sized to their squares. Hide and Seek uses one shared **Star Detective** position: every tap is final, one dangerous empty square loses the entire match, and the first complete safe-square set wins immediately. PostgreSQL's room lock decides the first verified finish; later answers cannot change that result. If the timer expires before either player finishes or makes a mistake, the match is a draw. There is no skip or Check board button. Taps are checked locally for instant feedback; the server independently validates the result. No hints or takebacks are provided. Battles do not modify solo records, quests, XP, or coins.

Finished matches offer **Rematch**. The first request creates a fresh room reserved for the same opponent; the opponent sees **Accept rematch**. Concurrent requests reuse that single room, automatically starting its countdown when both have joined. Previous results remain saved. Finished-result pages keep their Realtime subscription and visible-tab fallback refresh to receive invitations.

## Persistence and trust

- Signed Academy sessions and active-student checks protect every API request. The browser cannot directly read battle/deck tables or call mutation RPCs.
- Puzzle answers and future boards remain on the server. The server validates moves/routes/squares, scores, lives, and time limits.
- PostgreSQL serializes membership changes. Answers merge only the submitting player’s validated state under their personal revision, so simultaneous opponent answers do not force version-conflict retries. Personal revisions and action IDs prevent duplicate scoring after retries or in a second tab. The database also rejects score changes arriving after the deadline.
- Only one unexpired battle per student is allowed. Creation is limited to ten rooms per ten minutes. The lobby returns bounded recent/open lists.
- Realtime sends only an invalidation on an unpredictable room topic. Scores always come from authenticated API reads. Visible-tab fallback refresh runs every thirty seconds with Realtime connected, ten seconds during disconnected gameplay or on a result page, two seconds in every waiting room, and fifteen seconds in the lobby. Start/end boundaries refresh immediately; the first position preloads during the countdown and is displayed only when it ends. Own broadcasts and reads during a pending answer are coalesced. No battle polling runs elsewhere in the app.
- Decks are generated/read once and cached in a bounded process cache. Survival difficulty bands load concurrently but are concatenated in the fixed easy-to-hard order. Both players always read the same persisted room deck, with stable board IDs. Active student and credential validation plus the room (and deck on a cold instance) load in one service-only database RPC. Cold answers require two database calls; eligible warm answers use one, with current credential checks inside the save. Clock ticks are local. Star Wars and Hide and Seek validate locally for immediate interaction and submit their completed board for authoritative validation.
- Reloading preserves the score, lives, deadline, and current board. Survival also preserves accepted continuation moves. An unfinished Star Wars route or Hide and Seek selection restarts on that same board after reload; the match clock keeps running.

Survival and Star Wars keep the moved piece selected after a click, tap, or drag. After an accepted Survival move and the opponent reply, students can click the next destination directly. Selecting a different piece or tapping the selected piece still switches or clears selection. New boards reset selection.

## Performance verification

With an injected 100 ms delay on each database request and five pairs of simultaneous Survival answers, median pair completion improved from **749 ms to 254 ms** (about 66%). This measures the isolated HTTP/SQL path, not a guarantee for every real network. Browser checks hold a move request open to confirm immediate piece movement with no premature score. Duplicate actions, concurrent scores, active credentials, deadlines, and all shared positions (up to 50 in Survival/Star Wars and one in Hide and Seek) are tested.

The follow-up optimization measured **137 ms** under the same conditions (46% faster than 254 ms). A bounded server cache retains up to 32 recently verified room positions for one minute. When both the position and deck are warm and the submitting player's revision matches, validation can use that trusted snapshot. `submit_puzzle_battle_player` checks current active credentials and membership, then performs the existing revision/deadline-guarded save in one database round trip. Cold instances, expired snapshots, retries, and conflicts reload authoritative state; correctness never depends on cache affinity. No answers or future boards are sent to the browser. Unit tests cover another instance updating the room and access being revoked while a snapshot is cached.

## Release

### Computer opponents

Choose Computer in the lobby, then Gentle, Steady, or Swift. All three modes and all existing time controls support bots, with an automatic five-second countdown and a fresh-board rematch. Bots are paced practice opponents, not chess engines with Elo ratings. Their solve times and mistakes are generated once from the shared deck and difficulty, stored privately, and advanced using database time. Reloading or switching tabs never rerolls or pauses them. Existing match rules and the absence of battle XP/coin rewards are unchanged.

`20261101180002_puzzle_battle_bot_opponents.sql` was applied to production on November 2, 2026 (Asia/Bangkok), as remote version `20261101181850`, before releasing these handlers. It adds a service-only private bot plan, creation/advancement functions, and bot settlement before human writes. No synthetic student accounts or continuously running workers are needed. Bot rooms skip Realtime broadcasts/subscriptions; clients refresh at scheduled board boundaries, on foreground/reconnect, and with a 30-second backup (five-second recovery when a boundary update is missed). Regular warm answers still use one RPC. Only the next event time is public; future outcomes remain private. Human opponents keep their existing flow. Production permissions, creation, first-finish settlement, and idempotent replay were verified; test writes were rolled back.

Additional checks: `node tests/puzzle-battle/verify-bots-db.mjs`, `npx vitest run tests/puzzle-battle/bots.test.ts`, and `node tests/browser/verify-battle-bots.cjs` against the isolated local preview.

`supabase/migrations/20261101173014_puzzle_battle_cached_answers.sql` and `supabase/migrations/20261101174411_puzzle_battle_single_board_rematches.sql` were applied to production on November 2, 2026 (Asia/Bangkok), before deploying the handlers. Their remote versions are `20261101175511` and `20261101175515`. Service-only execution and empty search paths were verified for all affected functions.

For the continuation browser check, start the isolated server on port 9486 with `BATTLE_MULTIMOVE=1`, then run `node tests/browser/verify-battle-continuation.cjs`. Its three-move fixture exercises desktop drag followed by destination clicks, tablet/phone taps, switching pieces, resetting selection on new boards, and failed-save retries. The regular three-mode browser suite also solves Star Wars by clicking consecutive destinations.

`supabase/migrations/20261101171608_puzzle_battle_fast_actions.sql` was applied to production on November 2, 2026 (Asia/Bangkok), before deploying the new handlers. Its remote migration version is `20261101172401`. Existing progress and decks need no data rewrite. Both new functions retain service-only execution and an empty search path.

Apply `supabase/migrations/20261101103837_puzzle_battles.sql` before deploying the UI. It adds two service-only tables, RPCs, and a Realtime invalidation trigger. It does not modify existing student achievements or training progress. Applied to production on November 1, 2026. Service-only permissions and the create/update RPCs were verified; the RPC test transaction was rolled back.

The local preview uses fixture students and a small deterministic Survival pool. Production uses the existing active Lichess-derived puzzle snapshot already stored in Chess Quest; no live Lichess requests are added. Production Realtime delivery was verified with an isolated broadcast received by a public client. The full local journeys also exercise the fallback path, real HTTP handlers, and SQL functions.

## Verification

Survival input recovery: move requests time out after six seconds, reconcile authoritative progress, and retry the same action at most once after a network/server failure. An HTTP 200 with unchanged personal progress is not treated as a saved move: move, finish, and skip responses must acknowledge the action ID, advance the personal revision, or end the match. Unacknowledged responses use the same bounded recovery; the original ID/revision is preserved and never rebased onto another puzzle. Confirmed progress or a finished match is accepted without replay; client/auth rejections are not retried. A continuing failure leaves a visible Resume puzzle control on the board. Healthy moves still use one request. Promotion uses the shared regular-game graphical dialog, rendered above the board layout so it stays visible. It supports all four pieces, keyboard focus trapping, Cancel, and Escape. Error details stay in the controls column so they cannot push the board and resume control below the viewport.

`tests/puzzle-battle/client-recovery.test.ts` covers recovery limits, lost responses, stale revisions, and auth rejection. Run the isolated server with `BATTLE_PROMOTION=1` and `BATTLE_PREVIEW_PORT=9490`, then `node tests/browser/verify-survival-input-recovery.cjs` for desktop/tablet/phone promotion, timeout, dropped-request, dropped-response, prolonged-outage, resume, and reload checks. `BATTLE_PUZZLE_FILE` optionally supplies a local JSON puzzle array for replaying real puzzle sequences; the server remains isolated from production.

`node tests/browser/verify-battle-move-ack.cjs` against the normal fixture on port 9482 reproduces the silent snap-back with unchanged HTTP 200 responses, then verifies automatic recovery, a single saved score/revision, bounded failure, and manual resume. This is a reproduced failure path, not proof of the cause of every reported stalled puzzle.

```powershell
npm run lint
npm run build
npx vitest run tests/puzzle-battle tests/puzzle-training tests/navigation tests/student/whats-new.test.tsx tests/quests/seasonal.test.ts
node tests/puzzle-battle/verify-db.mjs
node tests/puzzle-battle/verify-fast-db.mjs
node tests/browser/puzzle-battle-server.cjs
# In a second terminal:
node tests/browser/verify-puzzle-battle.cjs
```

The isolated database harness follows the existing seasonal test setup and requires PGlite 0.5.8 under `work/achievement-db-test/node_modules`. If missing, install it with `npm install --prefix work/achievement-db-test --no-save @electric-sql/pglite@0.5.8`. The browser test uses the installed Edge executable and the existing Playwright runtime (override `PLAYWRIGHT_MODULE` if necessary).

Local preview: `http://127.0.0.1:9482/__qa/login`. For a second student, open `http://127.0.0.1:9482/__qa/login?user=1` in a separate browser profile/private window. The fixture database is memory-only and resets when this server stops. Its login/deck/time-test endpoints exist only in the local test server, never in Next production routes.

Verified: both players solve each mode; identical starting boards and deadlines; incorrect moves; skips; dropped successful response followed by an idempotent retry; reload; natural timed finish; result persistence; unauthorized third-player rejection; database permissions and stale-write/deadline protection. Screenshots cover desktop, landscape/portrait tablet, and phone layouts.

To reproduce the latency measurement, start the isolated server with `BATTLE_PREVIEW_PORT=9484` and `BATTLE_DB_DELAY_MS=100`, then run `node tests/puzzle-battle/measure-latency.cjs`. The timing harness requires the local preview and cannot be pointed at production without its test-only login endpoint.
