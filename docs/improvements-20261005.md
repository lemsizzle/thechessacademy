# ChessQuest improvements review

Local follow-up to the completed device and mode audit, prepared on 5 October 2026. This handoff covers the four requested improvements: durable Study drafts, usable chapter controls, a disposable backend test path, and an automated browser CI matrix.

## Review baseline

Checkout: `chessquest-improvements` under the current Codex task workspace. Branch: `improve/study-drafts-and-test-infrastructure`. Base commit: `cb465c5850f69a6511b18f71a6ec120612cff889`, also remote main when checked at 18:02 UTC. Changes remain uncommitted and local. No push, PR, merge, deployment, production database changes, real student edits, paid-service calls or container-runtime installation were performed for this follow-up. Other checkouts and their uncommitted work were preserved.

## What changed

- Study tree edits are saved to immutable browser recovery snapshots before the network debounce. Copies are scoped to the authenticated account and Study. Reload, navigation, tab closure and interrupted saves offer explicit recovery.
- Version conflicts preserve the server chapter and the local draft. Users can review the draft, save it as a new chapter, or explicitly use the saved chapter. Repeated or concurrent recovered-copy requests use a stable recovery ID, preventing duplicate chapters after a lost response.
- Newer edits survive older save responses. Restoring from another open tab retains that tab's source snapshot until its exact content is saved. Distinct branches stay recoverable; identical copies produce one prompt.
- Explicit logout and known account changes clear drafts and cancel pending local work across tabs. Temporary session lookup failures preserve recovery data. Viewers cannot restore or persist edits. Storage failures show an actionable warning and JSON download.
- Chapter selectors and chapter actions have at least 44px touch targets. Reorder, rename and delete are in a compact menu with disabled boundary actions and Escape/focus handling. Unsafe chapter actions are disabled while edits are pending.
- Added a sequential, bounded browser runner with port checks, local-only fixtures, process ownership cleanup, resumable selections, timestamps and result artifacts. Existing services are never terminated to claim a test port.
- Added a pinned Supabase CLI runner that assembles a unique, unlinked local auth/Study database from an explicit schema manifest. It uses synthetic students, real Next.js auth/Study handlers and strict local endpoint/environment guards.
- Added a GitHub Actions workflow with separate Chromium/WebKit jobs, type/unit/build checks, a local backend job, nightly extended coverage, time limits, read-only permissions and pinned action commits. It contains no production secrets or deployment step.

## Verification status

**Passed:** Next route type generation and TypeScript, 1,084 unit tests across 178 files, 9 local QA safety/process tests, production build, workflow YAML/configuration checks, and the browser coverage below. The final Study rerun passed all 30 cases. No known reproducible application failure remains in these completed checks. The real-backend blocker and unrun coverage are listed explicitly below.

The repository's `lint` command consists of Next route type generation and TypeScript checking; it does not run a separate ESLint ruleset. Browser tests ran headlessly on this Windows laptop with installed Microsoft Edge for Chromium and Playwright WebKit. These are viewport, touch and pointer emulations, not tests on physical iPads, Android devices or phones.

## Coverage matrix

| Area | Observed result | Scope |
| --- | --- | --- |
| Core component matrix | 110/110 passed | 11 fixtures x 5 device layouts x 2 engines: Studies, navigation, history, store, classes, admin editors, dashboard, rewards, chat, achievements and badges |
| Repeated journeys | 48/48 passed | 6 journeys x phone, tablet portrait, tablet landscape and desktop x 2 engines: navigation, classes, chat, training variants, latest Study draft and Star variants |
| Device interactions | 30/30 passed | Rotation with moves, Study overlays, keyboard/focus and board interactions across the five layouts and both engines |
| Study draft regressions | 30/30 passed (15 cases x 2 engines) | Navigation/back/reload/tab closure; version conflict; account isolation; simultaneous recoveries; lost copy response; committed-before-crash; temporary session failure; React Strict Mode; blocked messaging; viewer access; slow retry/unmount; newer edit during discard; recovery from a live tab; touch controls |
| Extended areas | 66/66 passed | Analysis, training, adventure, bot configuration, spectator and Arena fixtures at phone, tablet and desktop widths in both engines |
| Live-board interactions | 6 engine/viewport groups passed | Tap/deselect, keyboard, locked board, drag during reply, premove, stale snapshot and rollback at widths 390, 820 and 1440 |
| Extended mode flows | 6 engine/viewport groups plus 2 worker checks passed | Promotion keyboard/cancel/underpromotion, correspondence turns, resignation cancellation, Woodpecker, daily puzzle; actual local Stockfish worker produced a legal move in each engine |
| Two-session multiplayer | Both engines passed | Local HTTP challenge, cancel, rechallenge, decline, accept and game destination at phone/tablet sizes |
| Study touch menu | Both engines, 5 layouts passed | 44px targets, viewport containment, reorder boundaries, keyboard activation, Escape and returned focus; screenshots inspected |
| Local backend preparation | Passed | CLI-generated migration plus ordered schema concatenation and provenance; no SQL execution |
| Real auth/Study backend | Blocked; 7 checks not run | Docker-compatible local Linux engine is absent; runtime guard exits before creating a project or changing a database |
| GitHub Actions execution | Not run | Workflow is local and unpublished; YAML and action configuration were validated |

Layouts: phone 390x844, phone landscape 844x390, tablet portrait 820x1180, tablet landscape 1180x820 and desktop 1440x900. Some extended checks use the three portrait/desktop widths listed above rather than every orientation.

The component fixtures use actual React components with deterministic local transport responses. Their success does not prove production networking, database policies, payment/reward transactions, live Supabase Realtime or external OAuth. The two-session multiplayer fixture uses HTTP rather than production Realtime.

## Failures found and retested

The expanded tests exposed ambiguous text selectors and an incorrect assumption that a reopened Study displays the last move immediately. Tests now identify the alert region, wait for chapter loading and explicitly select the next move. A further two-tab regression reproduced removal of the first tab's recovery copy when restoring in a second tab; the hook now retains the source until its content has been acknowledged by the server.

The execution service reset during an earlier journey run after the core 110 checks passed. The stopped process and free fixture ports were verified before resuming unfinished suites. The report distinguishes the retained completed core results, the subsequent completed extended runs, and final targeted Study retests; it does not present the interrupted run as a complete pass.

## Blocked and remaining coverage

The laptop has no installed/running Docker-compatible Linux container engine. WSL also reports that it is not installed. No runtime was installed or system security settings changed. Real local SQL execution and all seven authored auth/Study integration checks remain unverified. The prepared schema is deliberately an auth/Study slice because the repository's historical migration chain is incomplete; it is not a production database reconstruction.

Physical-device behavior, production Supabase Realtime, real reward/quest ledger transactions, Google/registered-email/Lichess authentication and the entire student portal against a real backend remain outside this follow-up's verified coverage. The workflow can exercise the backend on a suitable Linux runner once reviewed and published, but that first CI run may expose SQL or platform issues that local preparation cannot establish.

Recovery data stays in the current browser, expires after 30 days, and is cleared on explicit logout/account switching. If browser storage and network saving both fail, the user must keep the page open or download the draft. Recovery cannot guarantee the latest data after a crash when browser storage rejects it.

## Review and rerun

Review `git diff` plus the new files listed below in the isolated checkout. The accompanying patch includes both tracked changes and new files. It was constructed with a temporary Git index, preserving the real index, and validated against the base commit. Apply only to a clean checkout of that base after running `git apply --check`.

Run `npm ci`, `npm run lint`, `npm run test:qa-tools`, `npm test -- --maxWorkers=1`, `npm run build`, and `npm run test:browser:extended`. Browser binaries must already be installed; see `docs/qa-automation.md` for existing Edge/cache options. `npm run test:e2e:prepare` prepares the isolated schema. `npm run test:e2e` additionally requires an authorized local Linux container engine. Clear `QA_CHECKS` and `QA_DRAFT_CASES` when running the complete matrix.

Evidence is retained locally in `work/comprehensive-qa`, `work/browser-ci`, `work/study-drafts` and the task-level `qa-evidence` directory. The accompanying sanitized evidence summary records final counts and report/patch hashes. Generated browser/CLI outputs and credentials are excluded from the patch.

## Exact changed files

19 modified files and 23 new files (42 total).

- New: `.github/workflows/qa.yml`
- Modified: `.gitignore`
- Modified: `app/api/chess/studies/[studyId]/route.ts`
- Modified: `app/student/logout/page.tsx`
- New: `chess/analysis/studyDraftSession.ts`
- New: `chess/analysis/studyDrafts.ts`
- New: `chess/components/StudyDraftRecovery.tsx`
- Modified: `chess/components/StudyEditor.tsx`
- New: `chess/hooks/useStudyDrafts.ts`
- Modified: `chess/persistence/studyServer.ts`
- Modified: `components/TopNav.tsx`
- Modified: `components/student/StudentPortalShell.tsx`
- New: `docs/improvements-20261005.md`
- New: `docs/qa-automation.md`
- Modified: `lib/auth/getCurrentUser.ts`
- Modified: `next.config.ts`
- Modified: `package-lock.json`
- Modified: `package.json`
- New: `scripts/lib/local-e2e-safety.mjs`
- New: `scripts/lib/qa-process.mjs`
- New: `scripts/run-browser-qa.mjs`
- New: `scripts/run-local-e2e.mjs`
- Modified: `scripts/serve-online-play-harness.mjs`
- New: `tests/auth/study-draft-logout.test.ts`
- Modified: `tests/browser/studies-qa-harness.jsx`
- New: `tests/browser/study-drafts-harness.jsx`
- Modified: `tests/browser/verify-areas.cjs`
- Modified: `tests/browser/verify-device-interactions.cjs`
- Modified: `tests/browser/verify-journeys.cjs`
- Modified: `tests/browser/verify-live.cjs`
- Modified: `tests/browser/verify-modes.cjs`
- Modified: `tests/browser/verify-online-journey.cjs`
- New: `tests/browser/verify-study-drafts.cjs`
- New: `tests/chess/study-draft-identity.test.ts`
- New: `tests/chess/study-drafts.test.ts`
- New: `tests/chess/study-recovery-copy.test.ts`
- New: `tests/e2e/local-grants.sql`
- New: `tests/e2e/process.test.mjs`
- New: `tests/e2e/safety.test.mjs`
- New: `tests/e2e/schema-manifest.json`
- New: `tests/e2e/supabase.toml`
- New: `tests/e2e/verify-auth-studies.cjs`
