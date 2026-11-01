# Puzzle Battle

Students open **Train → Puzzle Battle**, choose Survival, Star Wars, or Hide and Seek, and select 1, 3, 5, or 10 minutes. Create a challenge and share its code/link, or join an open challenge. Both students press Ready; a shared five-second countdown precedes the match.

Both players receive the same ordered deck of up to 50 boards. A fully completed board scores one point. A wrong answer or skip costs one of three lives. With no lives left, the student watches the opponent's score until that run or the clock ends. Highest score wins; equal scores draw. Leaving a started match forfeits it. Waiting challenges expire after ten minutes.

Survival requires the full puzzle continuation. Star Wars requires a complete star route. Hide and Seek uses **Star Detective** rules (the solo mode formerly named Hard Mode): every tap is final, a dangerous empty square immediately ends the board and costs a life, and finding all safe squares automatically submits the completed board. There is no Check board button. Taps are checked locally against the visible army for instant feedback; the server independently validates each submitted result. No hints or takebacks are provided. Battles do not modify solo records, quests, XP, or coins.

## Persistence and trust

- Signed Academy sessions and active-student checks protect every API request. The browser cannot directly read battle/deck tables or call mutation RPCs.
- Puzzle answers and future boards remain on the server. The server validates moves/routes/squares, scores, lives, and time limits.
- PostgreSQL serializes membership changes. Answers merge only the submitting player’s validated state under their personal revision, so simultaneous opponent answers do not force version-conflict retries. Personal revisions and action IDs prevent duplicate scoring after retries or in a second tab. The database also rejects score changes arriving after the deadline.
- Only one unexpired battle per student is allowed. Creation is limited to ten rooms per ten minutes. The lobby returns bounded recent/open lists.
- Realtime sends only an invalidation on an unpredictable room topic. Scores always come from authenticated API reads. Visible-tab fallback refresh runs every thirty seconds with Realtime connected, ten seconds during disconnected gameplay, two seconds in a disconnected waiting room, and fifteen seconds in the lobby. Start/end boundaries refresh immediately; the first position preloads during the countdown and is displayed only when it ends. Own broadcasts and reads during a pending answer are coalesced. No battle polling runs elsewhere in the app.
- Decks are generated/read once and cached in a bounded process cache. Survival difficulty bands load concurrently but are concatenated in the fixed easy-to-hard order. Both players always read the same persisted room deck, with stable board IDs. Active student and credential validation plus the room (and deck on a cold instance) load in one service-only database RPC. Normal answers require two database calls total. Clock ticks are local. Star Wars and Hide and Seek validate locally for immediate interaction and submit their completed board for authoritative validation.
- Reloading preserves the score, lives, deadline, and current board. Survival also preserves accepted continuation moves. An unfinished Star Wars route or Hide and Seek selection restarts on that same board after reload; the match clock keeps running.

## Performance verification

With an injected 100 ms delay on each database request and five pairs of simultaneous Survival answers, median pair completion improved from **749 ms to 254 ms** (about 66%). This measures the isolated HTTP/SQL path, not a guarantee for every real network. Browser checks hold a move request open to confirm immediate piece movement with no premature score. Duplicate actions, concurrent scores, active credentials, deadlines, and all 50 shared positions in each mode are tested.

## Release

`supabase/migrations/20261101171608_puzzle_battle_fast_actions.sql` was applied to production on November 2, 2026 (Asia/Bangkok), before deploying the new handlers. Its remote migration version is `20261101172401`. Existing progress and decks need no data rewrite. Both new functions retain service-only execution and an empty search path.

Apply `supabase/migrations/20261101103837_puzzle_battles.sql` before deploying the UI. It adds two service-only tables, RPCs, and a Realtime invalidation trigger. It does not modify existing student achievements or training progress. Applied to production on November 1, 2026. Service-only permissions and the create/update RPCs were verified; the RPC test transaction was rolled back.

The local preview uses fixture students and a small deterministic Survival pool. Production uses the existing active Lichess-derived puzzle snapshot already stored in Chess Quest; no live Lichess requests are added. Production Realtime delivery was verified with an isolated broadcast received by a public client. The full local journeys also exercise the fallback path, real HTTP handlers, and SQL functions.

## Verification

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
