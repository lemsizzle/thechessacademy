# Chaos Mastery

Mixed Themes Survival badge series, using the established Survival rewards:

| Tier | Hint-free solves in one round | One-time coins |
| --- | ---: | ---: |
| Bronze | 10 | 20 |
| Silver | 20 | 40 |
| Gold | 30 | 100 |
| Platinum | 40 | 200 |

Only new rounds count, as requested. The badge creation time is the launch
boundary; any round with an earlier recorded attempt is ineligible, including
resumed rounds. There is no historical backfill. Distinct solved puzzles with
zero hints count. Scores cannot accumulate across rounds or selected themes.
Mixed rounds earn only Chaos Mastery, never focused tactic badges.

The existing restricted award function, reset locks, idempotent coin ledger and
round attribution are reused. These badges grant coins, not extra XP.

Migration `20260909022308_mixed_survival_chaos_mastery.sql` is applied to Supabase.
Four generated artwork files are published and verified byte-for-byte.
The application changes require a push before live Mixed Themes attempts invoke
the award check. No commit or push was performed as part of initial preparation.

Built-in image generation was used. Prompts and source paths are recorded in
`work/badge-art/chaos-mastery/manifest.json`; source PNGs, final WebPs and the
publication receipt are in the same folder.

Verification:
- TypeScript check, 742 tests, production build.
- `verify-mixed-survival-badges.mjs`: disposable database, focused regression,
  all mixed milestones, exact coins, hints, duplicate solves, separate rounds,
  resumed old rounds, repeat migration, award retries and restricted permissions.
- `verify-mixed-survival-rewards.sql`: real database triggers and rewards,
  four artwork awards, XP/coins, retry safety, round/student isolation.
  Temporary fixtures are unconditionally rolled back.
- Security advisors: no new findings; existing server-only RLS notices and
  existing pg_net extension placement warning unchanged.
