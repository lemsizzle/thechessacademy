# Academy Arena experience

## Policy

New and not-yet-started scheduled Arenas use experience version 1. Existing active
and historical Arenas stay version 0. Scoring remains 2/win, 1/draw, with the
existing Berserk bonus. Bots are practice opponents, not student podium entrants.

“Finish tournament” is an early deadline: no new games, current games finish and
count, then prizes settle. “Cancel without prizes” deliberately skips settlement.
Finished/cancelled version-1 tournaments cannot be restarted or changed into one
another.

Students are queued by a durable timestamp, with presence expiring after 20
seconds. Heartbeats do not move an online student up the queue. Reconnecting
after expiry enters at the back. Humans pair first; bot fallback requires five
seconds. Lobby, game/result, and spectator screens keep relevant presence alive.
All new pairing, pause, early-finish, and settlement decisions acquire the Arena
row lock; the insert guard rechecks the actual wall clock.

The student prize pool is 100 / 50 / 30 coins. At least one completed game is
required. Tied students first compare wins, then head-to-head points only when
every pair in their tied group has met. Unresolved ties share all occupied prize
places they span, rounded down. No extra XP, no bot prizes, no unused-place awards.
Snapshot insert, coin ledger entries, wallet updates, and activity events commit
together. The snapshot is not writable/deletable by the application role.

## Release order — not yet deployed

1. Review and apply 20260908143115_academy_arena_experience.sql, then
   20260908145431_academy_arena_maintenance.sql to the existing Supabase project.
   Coordinate with application deployment: version-1 pairing needs the new
   presence endpoint. Do not leave the old app serving new Arenas between steps.
2. Deploy the application changes together. Do not include unrelated avatar,
   badge-reset, or existing migration work in this release.
3. Verify the deployed protected maintenance route authenticates using the
   production ARENA_MAINTENANCE_SECRET (with CRON_SECRET as a legacy fallback).
   For first-time setup when existing sensitive values cannot be exported, run
   scripts/provision-arena-maintenance.mjs with the Vercel CLI entrypoint and
   --provision, then deploy while it waits. It creates a separate random secret,
   verifies the deployed route and stores it in Vault without printing it.
   Otherwise securely provision the same token to Vault with
   “node scripts/activate-arena-maintenance.mjs --activate”. The script refuses
   activation if the deployed endpoint cannot authenticate. It never prints secrets.
4. Confirm academy-arena-maintenance runs every minute in cron.job_run_details
   and receives HTTP 200 in net._http_response. The migration schedules the job,
   but it makes no requests until its Vault token exists.
5. Run a controlled tournament using dedicated test students: simultaneous joins,
   student-first pairing, five-second fallback, teacher pause/resume, break and
   reconnect, a late-finishing game after both a normal and early deadline,
   then verify the final snapshot, wallet deltas and ledger idempotency. Use a
   dedicated Supabase test branch for genuinely concurrent database-session
   race tests. Do not count serialized WASM calls as a concurrent Postgres test.
6. Do not consider rollout complete until the deployed controlled tournament and
   browser-closed maintenance check pass. No production database changes or coin
   grants were made during local verification.

## Verification

- npm test -- --maxWorkers=4
- npm run lint
- npm run build
- node scripts/verify-arena-experience.mjs <path-to-@electric-sql/pglite>

The isolated PostgreSQL/WASM script builds the existing Arena migrations and uses
the actual coin-ledger function. It checks policy grandfathering, FIFO priority,
heartbeat stability, bot delay, stale/reconnected clients, breaks, repeat-opponent
rejection, teacher pause, exhibitions, early finish, late results, head-to-head,
ties across prize boundaries, small fields, no-game eligibility, cancellation,
failed-payout rollback/retry, repeated settlement, and role permissions.

Local browser checks cover 390px mobile and desktop, live-board previews, tabs,
keyboard arrows, image loading, reduced motion and once-only podium celebration.
Temporary preview route removed after verification; screenshots are under work/.

## Recovery and monitoring

Keep additive schema if an application rollback is needed. Pause pairings for
version-1 Arenas during recovery; do not downgrade already-paid Arenas, delete
ledger transactions, or replay rewards manually. The next successful maintenance
call retries an unsettled tournament without repeating committed awards.

Inspect internal_arena_results, coin_transactions with source type arena_podium,
and activity_events for the final audit trail. Maintenance returns HTTP 500 if any
game/finalization needs retry and HTTP 401 for absent/wrong tokens.
The minute task resolves expired clocks and completed-but-unrecorded games even
with no open browser. It processes at most 100 outstanding games per run.
