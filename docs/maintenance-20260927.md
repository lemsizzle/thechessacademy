# Weekly maintenance — 27 September 2026

Inspected canonical main `9dadc7e279e199e7044170deac1521187e1577bc`, freshly fetched from origin. The requested primary checkout remains on `feature/internal-chess-system` with unfinished avatar/theme changes. This pass is isolated in `D:\The Chess Academy Web App\maintenance-20260927`, branch `maintenance/weekly-20260927`. Dependencies were copied from a checkout with an identical package-lock SHA256; no dependency versions changed.

## Improvement and evidence

`useArenaQueue` previously installed a one-second interval and two global listeners even with no tournament ID. This occurs on ordinary live games, teacher spectators, and teacher Arena lobbies. Skip the presence effect in that case. Switching into an Arena still installs the existing effect; switching out removes its resources.

Controlled before/after browser results, each on Chromium and WebKit at 390 and 1440 pixels:

| Metric per mounted hook without an Arena | Before | After |
| --- | ---: | ---: |
| Timer callbacks during 2.2 seconds | 2 | 0 |
| Arena visibility/online listeners | 2 | 0 |
| Presence requests | 0 | 0 |

Active three-second queue polling, suppression of hidden-tab requests, visibility recovery, join-to-game navigation, switching out of an Arena, and unmount cleanup passed in all four configurations. These are actual hook fixtures with mocked presence responses, not production matchmaking or frame-rate measurements. No chess rules, puzzle engine, clocks, rewards, or data writes were changed. Source fixtures and raw results are in `work/maintenance-20260927/`.

## Validation

- TypeScript/lint passed; production build passed.
- Full suite: 981 tests in 161 files passed with two workers.
- Browser checks described above passed, using tap input at phone width and click input at desktop width.
- `git diff --check` passed.
- No production progress/reward writes or authenticated production gameplay were exercised. No claim is made about production latency or persisted rewards from this local fixture.

## Student cleanup

Read-only live schema inspection confirmed `students.id` (UUID), `is_active` (boolean), and `updated_at`, with no `archived_at` column. Aggregate counts: 56 active, zero inactive, zero unspecified. Eligible profiles: 0. Archived/restored/deleted: 0. No student data or related history changed.

Active roster reads and authenticated student access already filter `is_active=true`. The inspected profile editor does not expose an archive/restore operation; its delete action is not an archival mechanism and was not used. There are no candidates requiring a new archive workflow this run. If inactive rows appear in a future run, preserve them and verify a guarded reactivation (`is_active=true` on the same identity) with disposable data before relying on a restoration workflow. Do not infer inactivity or delete records.

## Pending work and rollback

The user authorized publishing on 28 September 2026. This maintenance change is released separately from earlier unfinished feature work. No migration or data mutation is needed. Rollback is limited to removing the new missing-tournament guard and its effect dependency in `chess/hooks/useArenaQueue.ts`; no data rollback is needed.

Earlier Lichess identity-only changes, 23 September optimizations, and five-minute bot recovery remain in the separate `lichess-auth-only` checkout and are not in this main revision. They were not reapplied or overwritten. Original artwork, backups, and other checkouts were preserved.

