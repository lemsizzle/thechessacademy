# Maintenance - 2026-10-11

Inspected current canonical main 370197a852aa5523460712fea72fe10e04ecfb59, current AGENTS.md, Git status, recent changes and the October 3/4 maintenance record. Used isolated checkout D:\The Chess Academy Web App\maintenance-20261011 on maintenance/optimization-20261011. Existing artwork, unfinished feature work and the older maintenance checkout remain untouched.

## Improvement and measurements

Adapted the pending October 3 LiveGameSpectator optimization to current main. This replaces the older checkout as the current integration candidate; do not apply both patches. Recent changes to computer-game closure, badges, board layout and sound controls are preserved. Snapshot refreshes share one in-flight request; realtime notifications queue a follow-up so newer moves are delivered. Navigation/unmount cancels pending work and ignores stale responses. Stalled requests have an eight-second timeout.

Fresh comparison against this week's main, in Chromium and WebKit at 390px and 1440px: three rapid focus events produce 3 overlapping requests before and 1 after (67% fewer in the controlled burst); game switching cancels 0 requests before and 1 after. No production latency, bundle-size or whole-app speed claim is implied.

## Validation

- Exact lockfile dependencies installed in this checkout.
- npm run lint passed (type generation and TypeScript).
- npm test -- --maxWorkers=2 passed: 186 files, 1,150 tests.
- npm run build passed.
- Browser checks passed in all four browser/viewport combinations: realtime delivery of legal e4, replay navigation, ticking clocks, failure/retry recovery, request cancellation on game switch/unmount, and the new computer-game 404 closure retaining its last board position.
- Harness, baseline source, result JSON and logs retained under work/optimization-20261011. These are actual-component checks with controlled API/realtime responses, not authenticated production end-to-end tests. No production gameplay/progress/reward writes. Puzzle behavior was not changed; its automated tests ran in the full suite.
- git diff --check passed. Restricted process startup initially failed; authorized elevated execution worked. No outstanding tooling failure.

## Student cleanup

Live schema confirms students.is_active is boolean and no archived_at column exists. Fresh aggregate: 59 active, 0 inactive, 0 unspecified. No qualifying archival candidates. Archived 0; deleted 0; identities, rewards and history preserved. No archive/restore or schema writes performed and no restoration needed.

## Release and rollback

The user explicitly requested a push on October 11 after validation. This change is prepared for publication to main; deployment status must be verified separately. No migration is required. Rollback is limited to reverting the request coordination/cancellation changes in chess/components/LiveGameSpectator.tsx; no data rollback required. Previous maintenance source remains preserved in maintenance-20260927, but future publishing should use this updated candidate based on 370197a.
