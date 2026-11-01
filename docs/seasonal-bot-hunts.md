# Seasonal bot hunts

Thanksgiving 2026 introduces reusable seasonal configuration. Halloween retains its existing database function and completion IDs so previously earned rewards are untouched.

## Add a holiday

1. Add a `SeasonalBotHunt` to `lib/quests/seasonalBotHunts.ts`, with unique year-specific quest/bot IDs, an explicit start and exclusive end instant, a readable deadline with time zone, and a unique `seasonal:` completion prefix. Keep retired entries for saved games and history.
2. Supply bot portraits and the completion badge. Generated Thanksgiving prompts are recorded in `docs/thanksgiving-art-prompts.json`. Estimated bot strengths are interpolated from the existing difficulty profiles.
3. Create a migration inserting the badge, an initially disabled `academy_quests` row, and its matching `seasonal_bot_hunts` row. The shared trigger automatically counts distinct unassisted wins and awards the quest once. Use zero badge XP when the quest reward already includes the full intended award. The existing XP ledger trigger grants matching coins; do not insert a second coin award.
4. Match IDs, dates, bot list, reward and badge between the registry and database. Add the student announcement to `lib/student/whatsNew.ts` and update coverage.
5. Run unit/type/build checks and the isolated SQL/browser checks. Adaptation only reads currently active hunts, on setup and after losses; gameplay has no added per-move requests.

## Thanksgiving release

Prepared migration: `supabase/migrations/20261101095251_seasonal_bot_hunts.sql`. It is tested locally and deliberately seeds the quest with `is_active=false,is_live=false`.

On the authorized release, apply that migration and deploy the matching application/artwork. Once the deployment is ready, enable the event:

```sql
update public.academy_quests
set is_active=true,is_live=true
where id='thanksgiving-2026-bot-quest';
```

Verify the authenticated seasonal progress endpoint and that all five portraits and the badge load. Do not bulk replay repository migrations: production has additional applied migrations, including Halloween's completion badge. Inspect migration history first.

The exclusive deadline is `2026-11-28T00:00:00-08:00`: students have all of Friday November 27 in Pacific time, the day after U.S. Thanksgiving. This is November 28 at 15:00 Bangkok. Both the completed timestamp and server receipt must precede the deadline. No cron is needed to close the hunt.

## Verification

```text
npx vitest run tests/quests/seasonal.test.ts tests/quests/halloween.test.ts tests/chess/halloween-adaptation.test.ts tests/chess/halloween-adaptation-route.test.ts tests/chess/bot-progression.test.ts tests/student/whats-new.test.tsx
node tests/quests/verify-seasonal-db.mjs
npm run lint
npm run build
node tests/browser/seasonal-server.cjs
node tests/browser/verify-seasonal.cjs
```

The SQL fixture uses PGlite from `work/achievement-db-test/node_modules`. Browser QA uses an isolated student/database on port 9478 and local mock REST on 9479; it cannot write to production. It exercises the real game-save handler, legal complete-game fixtures, assistance exclusion, one-time rewards, reload persistence and the badge artwork dialog. Restart the fixture server before rerunning the browser test to reset progress. The preview is a test account, not real student progress.
