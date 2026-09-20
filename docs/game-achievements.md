# Game achievement collection

71 automatic, one-time badges: 63 challenges inspired by Rosen Score and eight learning milestones. Each grants the badge's XP amount and the same number of Academy Coins through the existing XP-event coin trigger. Learning badges award 25, unusual discoveries 50, rare achievements 100.

Students find the collection under **More → Game Achievements** or the dashboard trophy case. They can filter by collection, earned/locked status, or search. Earned badges include a replay link to the recorded moment. Academy links open the analysis board at the saved ply; Lichess links open the source game.

## Eligibility and deliberate limits

- The release timestamp is created by the migration. Only games **started** on or after that timestamp qualify. No historical backfill.
- Completed Academy games must start from the normal starting position and use no takebacks. Bot, live, tournament and correspondence results share the saved-game pipeline. Puzzles, studies and analysis variations are not eligible.
- Lichess detection reuses games already downloaded by account/quest activity sync. The ordinary account sync covers rated rapid and blitz; active quest categories may add other time controls. This is not a complete archive import, and unsynchronized games cannot earn badges. No Chess.com integration is added.
- Ten/twenty consecutive-win badges use only eligible Academy games. An intervening eligible Academy loss, draw or different opponent breaks the streak. Capped Lichess exports cannot prove an unbroken series, so they never award these two badges.
- Time badges require recorded move clocks. Live Academy moves record authoritative milliseconds; Lichess centiseconds are converted explicitly. Missing clock data is never inferred. Lichess abandonment (`timeout`) is distinct from running out of time (`outoftime`).
- Learning detections use explicit, conservative board patterns, not engine judgments of move quality. Forks, pins, skewers and discovered attacks require follow-up captures. These are discoveries, not automatic mastery assessments. Novelty challenges are optional and not recommended strategies.

## Persistence and performance

An insert trigger queues Academy games in the same transaction as the existing completed-game save. `next/server` `after` processes at most 12 pending games outside the move response. Dashboard visits retry pending work; the collection page drains one batch before reading earned status. Lichess scans reuse existing downloads, keep a temporary payload only while queued, and use unique student/source IDs.

The completion RPC takes a per-student transaction lock. Badge insertion, XP, the existing coin trigger, activity, evidence, and queue completion commit together. Unique student/badge rows make duplicate callbacks, requests and games harmless. Database errors remain retryable. Invalid move histories are marked processed with `validation_error`, award nothing, and break streaks; they do not block later games.

New tables have RLS and no anonymous/authenticated grants. Only trusted service-role code can enqueue or complete scans. Award amounts come from the badge catalog in the database, never the browser. Art is 71 small, static SVG medals served with the application; no Supabase Storage downloads or runtime image generation are needed.

The existing completed-game trust model is retained: live games have authoritative server moves; standalone bot games use the existing validated save endpoint. These rewards are not an anti-cheat system.

## Release

Production migration applied on 2026-09-20 at 19:18:39 UTC (September 21 in Bangkok). This is the eligibility cutoff. The live service-role reward transaction, matching coin grant and duplicate protection were verified inside a transaction that was rolled back, leaving student records unchanged. Release validation passed 944 tests, type checks and the production build after integrating the latest main-branch performance changes.

1. Review `supabase/migrations/20260920181926_game_achievement_badges.sql` against the deployed schema. The existing positive `xp_events` coin trigger must remain active.
2. Apply that migration immediately before deploying the code. Its timestamp starts eligibility. Never reseed or move the epoch backward to grant historical rewards. The new `student_badges.achievement_evidence` column must exist before this code is deployed.
3. Verify 71 `game_achievement_rules` rows, private table/function privileges, and Supabase advisors. Confirm release timestamp and the existing coin trigger.
4. Deploy, complete an eligible test game, and check its queue row, earned badge/evidence, XP event, and coin ledger. Repeat the scan and confirm no second award. Refresh the collection and follow the replay link.

If a stored move history is repaired, inspect `validation_error`, restore the correct `won` value and input data, clear `processed_at`/`validation_error`, then retry. Do not clear earned badge or ledger rows to retry a scan.

## Local verification

```powershell
npm run lint
npm test -- --reporter=dot --maxWorkers=4
npm run build
# Isolated PostgreSQL engine; no connection to production:
npm install --prefix work/achievement-db-test --no-save @electric-sql/pglite@0.5.8
node scripts/test-game-achievement-database.mjs
# Actual collection and dialog with explicitly labeled example data:
$env:GAMEPLAY_FIXTURE='tests/browser/achievements-harness.jsx'
$env:GAMEPLAY_PORT='9419'
node scripts/serve-gameplay-harness.mjs
```

The isolated database test applies the real migration to representative existing tables and an equivalent coin trigger. It covers legal-game detection through persisted rewards, transaction rollback, retries, duplicates, release cutoff, takebacks, streak resets, Lichess streak exclusion and private privileges. It does not mutate production accounts or replace a post-deployment smoke test.

Browser verification covers desktop and 390px mobile collection layouts, filters, search, earned and locked dialogs, keyboard focus, replay targets, and horizontal overflow. The local preview uses two sample awards, not live student records.

Reference rules and test-game fixtures are adapted from [Rosen Score](https://github.com/fitztrev/rosen-score), MIT © 2022 Trevor Fitzgerald. The full notice is in `docs/licenses/rosen-score-MIT.txt`. Chess Quest artwork is original SVG artwork. No affiliation with Eric Rosen is implied.
