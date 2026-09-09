# Arena Legends

| Badge | Tier | Requirement |
| --- | --- | --- |
| Bronze Contender | Bronze | Finish 3rd |
| Silver Challenger | Silver | Finish 2nd |
| Golden Champion | Gold | Finish 1st |
| Platinum Dynasty | Platinum | Win 5 distinct tournaments |

Only finalized in-app arena results count. Historical recorded results are included
as requested. Official tied ranks count as that placing; at least one game must
have been played. Cancelled, active and legacy/non-finalized events do not count.
No Lichess results are imported. Exact placing earns its own badge, not all lower
tiers. The trophy case groups earned Arena Legends badges highest tier first.

The badges add no extra XP or coins; existing arena podium prizes are unchanged.
The trigger uses existing immutable result snapshots and student badge uniqueness,
with per-student transaction locks and deterministic ordering. Functions are
security-invoker and service-role-only; no public policies or grants are expanded.

## Release status

Published to Supabase on 2026-09-09 with user approval. The applied migration is
`supabase/migrations/20260909020352_arena_legends_badges.sql`.
Historical recognition awarded two Gold, two Silver and one Bronze badge; no
student yet qualified for Platinum. All four public artwork files were verified
byte-for-byte against the local WebP files. The publication receipt is
`work/badge-art/arena-legends/published.json`.

Artwork was generated with the built-in image generator. Exact prompts and source
provenance are in `work/badge-art/arena-legends/manifest.json`. `prepare.cjs`
normalizes the final files and renders the contact sheet.

## Verification

`scripts/verify-arena-legends.mjs <installed-pglite-path>` tests exact tiers,
historical backfill, five wins, tied ranks, no-games eligibility, cancelled/active/
legacy exclusion, replay safety and restricted function execution in a disposable
database. `tests/badges/arenaLegends.test.ts` covers names and series grouping.
