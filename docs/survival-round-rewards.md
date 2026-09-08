# Survival round rewards

The Survival results screen shows saved XP, total Academy Coins, and artwork for badges newly earned in that round. The coin total includes puzzle coins and badge bonuses exactly once. Other puzzle modes keep their existing results screens.

`GET /api/student/puzzle-training/rewards?sessionId=<uuid>` requires an active student session and derives the student ID from the signed cookie. It calls the read-only, service-role-only `get_survival_round_rewards` function. Responses are private and not cached. Missing data loads as zero; unavailable data shows a retry state instead of misleading totals.

XP comes from `academy_activity_rewards` for Survival attempts in this session. Puzzle coins are joined by the XP event's unique coin-ledger key. Badges are attributed via `student_badges.survival_session_id`; their coin transactions must be on or after the award date, excluding earlier reset epochs. Badge definition XP values are not added to the round's actual earned XP.

The migration `20260908081238_survival_round_rewards.sql` adds nullable round attribution to newly awarded tactical badges and preserves existing badge qualification and idempotency rules. It does not backfill ambiguous historical badge rounds or grant new rewards by itself. Applied to the shared Supabase project on September 8, 2026. The UI still requires an application deployment.

Verification:

- `npm run lint`
- `npm test -- --maxWorkers=4` (719 passing tests)
- `npm run build`
- `scripts/verify-survival-round-rewards.sql`: real triggers and award function, disposable students, unconditional rollback. Covers 40 solves / 80 XP / 80 puzzle coins / 360 badge coins, artwork, retries, round separation, student separation, and RPC permissions.
- Desktop and 390px mobile browser previews: all four artwork images load, no horizontal overflow, no error overlay, empty results and retry button verified. Local unauthenticated rewards request returns 401; authenticated identity and RPC response handling covered by route tests.
- Database security advisors unchanged: no new security findings.

No production student awards or balances were changed by verification.
