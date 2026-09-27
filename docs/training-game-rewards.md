# Star Wars and Hide and Seek rewards

- Every server-verified Star Wars mission earns 3 XP and 3 Academy Coins, in Classic and Time Trial. Each new run can earn rewards again.
- Each Hide and Seek round finding all safe squares earns 10 XP and 10 coins, in Classic, Time Trial and Hard Mode. Incomplete searches and Hard Mode explosions earn nothing. Speed and a perfect score are not required.
- Rewards start when the migration is applied. Historical completions are not backfilled; newly completed levels in an existing Star Wars run still earn rewards.
- Progress, XP events, total XP and coins commit together. The existing XP-to-coins trigger credits the wallet. No extra reward request or polling is added to gameplay.
- A locked Star Wars score update pays only its newly completed levels. Hide and Seek pays after the unique student/round insert succeeds. Repeated and overlapping saves cannot award twice, including insert conflicts.
- API responses read the stored reward total, so retrying an old result cannot claim a reward it never received.
- Rewards appear in the existing student XP/wallet and teacher XP history. New rewards use descriptive XP event reasons.

## Release

Applied `supabase/migrations/20260924012226_training_game_rewards.sql` to the existing production Supabase project on 2026-09-28 before deploying the UI/API changes. It is additive and compatible with the previous app version.

## Verification

- `npm run lint`, `npm test -- --reporter=dot --maxWorkers=4`, `npm run build`.
- `node scripts/test-training-game-rewards.mjs`: actual server validators and save functions against isolated PGlite, real game tables, real coin functions and the reward migration. Covers every mode, retries, overlapping saves, historical runs, incomplete/invalid submissions, another student's run, Hard Mode explosions, wallet-write failure and rollback, recovery, and role permissions. Uses the existing local PGlite install documented at the top of `scripts/test-game-achievement-database.mjs`.
- Browser fixture: set `GAMEPLAY_FIXTURE=tests/browser/training-rewards-harness.jsx` and run `node scripts/serve-gameplay-harness.mjs`. Add `?hide` for Hide and Seek and `&retry` (or `?retry` for Star Wars) to fail the first save. It shows visible test solutions and exercises actual board controls, reward messages and retry actions with mocked APIs; no production currency is issued.

Production migration checks should verify both reward columns, the three enabled triggers, service-role permissions and the existing XP coin trigger before releasing the app.
