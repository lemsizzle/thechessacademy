# Local QA and CI

Use Node 24 and `npm ci`. Playwright 1.62.1 and Supabase CLI 2.119.0 are pinned in the lockfile. All new checks use synthetic users and local services. No production keys, student records, paid services or cloud project links are needed.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | Next route types and TypeScript |
| `npm test -- --maxWorkers=1` | Unit regressions, with conservative local CPU use |
| `npm run test:qa-tools` | Local URL, Docker endpoint, environment and cleanup guards |
| `npm run build` | Production compilation |
| `npm run test:browser:drafts` | Recovery, conflicts, logout, storage failures and Study touch controls |
| `npm run test:browser` | Core browser matrix, journeys, overlays and device interactions |
| `npm run test:browser:extended` | Core plus gameplay, puzzles, adventure, bots and two-session multiplayer fixtures |
| `npm run test:e2e:prepare` | Prepare the isolated schema without Docker; does not execute SQL |
| `npm run test:e2e` | Real local Supabase + Next.js auth/Study integration; requires a local Linux container engine |

Install browser binaries once with `npx --no-install playwright install chromium webkit`. On Linux, use `--with-deps` when the host is authorized for package installation. The runner itself never installs browsers or a container runtime.

For one browser in PowerShell:

```powershell
$env:QA_ENGINES = 'chromium'
npm run test:browser
```

On a Windows machine already using Edge, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point to its executable. This is Edge/Chromium coverage, not a claim to have run the bundled Chromium binary. `PLAYWRIGHT_BROWSERS_PATH` can point to an existing Playwright browser cache. Tests are headless, with touch/pointer emulation; physical iPad/Android/phone hardware still requires a separate check.

## Browser coverage

To resume an interrupted run, `QA_CHECKS` may select comma-separated script names from the chosen suite (for example `journeys,device-interactions,study-drafts`). Unknown names fail before any fixture starts. Clear this override for a complete run. Runner summaries include start/finish timestamps so an interrupted report can be distinguished from a completed one.

For a focused Study regression, `QA_DRAFT_CASES` can select named cases such as `recoverFromLiveTab,committedBeforeCrash`. Clear it for the full 15-case-per-engine draft suite.

The runner compiles fixtures sequentially, uses one browser at a time, checks that its ports are free, waits for HTTP readiness, applies per-script timeouts and closes only its own processes. Existing services on those ports are left alone.

| Coverage | Engines | Viewports / interactions |
| --- | --- | --- |
| Core Study, navigation, game history, store, classes, admin editors, dashboard, rewards, chat, achievements and badges | Chromium, WebKit | Phone 390x844 and 844x390; tablet 820x1180 and 1180x820; desktop 1440x900 |
| Navigation and repeated journeys | Chromium, WebKit | Phone, tablet portrait/landscape, desktop |
| Device interactions | Chromium, WebKit | Touch moves, board rotation, promotion, cancel/back, overlays and keyboard focus |
| Study recovery | Chromium, WebKit | Navigation/reload/tab close, concurrent tabs, server conflicts, repeated copy requests, logout/account scope, blocked/quota storage, delayed replies, viewer access and 44px controls |
| Extended gameplay | Chromium, WebKit | Analysis, bots, live-board fixture, puzzles, adventure, spectators, Arena and multiplayer challenge/cancel/decline/accept |

The component fixtures replace transport and engine thinking with deterministic local responses. They verify the actual React components and UI behavior. They do not establish real Supabase Realtime, Lichess, reward-ledger or OAuth coverage.

Fixture ports are 9418 (areas), 9420 (core), 9422 (drafts); extended checks also use 9417 and 9421. Results and failure screenshots are under `work/browser-ci`, `work/comprehensive-qa`, `work/gameplay-audit` and `work/study-drafts`. These generated directories are ignored by Git.

## Disposable backend

`test:e2e` requires an already installed/running Docker-compatible Linux container engine. It refuses remote Docker contexts, remote named pipes, remote Supabase URLs, occupied test ports and Next `.env` files. Use a clean checkout; do not copy production environment files into it.

Each invocation creates a unique unlinked project beneath `work/local-e2e/run-*`. It asks the pinned CLI to generate a migration and fills it with the ordered files in `tests/e2e/schema-manifest.json`, recording a SHA-256 provenance manifest. The repository predates its complete versioned migration history, so this is an explicit auth/Study schema slice, not a reconstructed production database. `local-grants.sql` supplies the old baseline's missing service-role grants for this disposable database only. It is not a production migration.

The runner creates two synthetic Academy students with random passwords, uses the actual teacher and student login endpoints, and starts the real Next development server on port 9470 with an isolated `.next-e2e` output directory. Supabase uses API port 55431 and Postgres port 55432. Generated credentials are passed through child-process environment variables; they are not written to `.env` or uploaded as artifacts. Academy cookies remain HTTP-only; local HTTP is why this suite uses the development server. The separate build check verifies production compilation.

The backend suite checks:

- Teacher/Academy authentication and unauthenticated denial.
- Private Study access between two real student sessions and denial of direct anonymous table access.
- Atomic version conflicts from concurrent saves.
- Teacher-granted viewer access, rejected writes and membership revocation.
- Idempotent recovered copies under simultaneous/repeated requests.
- Actual Study page moves, server persistence, navigation recovery after an injected failed save, and logout.

The failure injection affects one browser save request; successful Study and auth operations use real handlers, PostgREST and Postgres. Student portal-wide features, live Realtime games, reward transactions, registered-email/Google/Lichess auth and the entire historical migration chain are outside this backend slice.

Cleanup stops the unique generated project with `--project-id ... --no-backup`. It never uses `--all`, cloud login/link/push/reset commands or a production project reference. If the host is terminated so abruptly that cleanup cannot run, the generated `supabase/config.toml` identifies the exact disposable project. Only stop that project; never stop all local projects. Generated local CLI/database files are ignored and should not be published.

If the runtime is unavailable, `test:e2e` exits with a clear blocker before creating a project or changing a database. `test:e2e:prepare` remains available for schema assembly checks; success there does not mean SQL execution or real E2E passed.

## CI

`.github/workflows/qa.yml` contains checks, Chromium/WebKit browser jobs, and a real local backend job on Ubuntu 24.04. Pull requests and main pushes run the core suite; the nightly schedule and the manual extended option add longer fixture journeys. Jobs have explicit deadlines, read-only repository permissions, per-ref cancellation and actions pinned to full commit hashes. No repository secrets or production deployment step are used.

Artifacts retain synthetic results and screenshots for seven days. Backend uploads explicitly exclude CLI output, environment files and local database volumes. The workflow must first be reviewed and published by someone with publication authority; a local YAML validation is not a successful GitHub Actions run.

## Study recovery behavior

Every unsaved tree edit gets a unique, immutable browser snapshot scoped to the authenticated actor and Study. A successful save removes only the acknowledged snapshot. Newer edits and another tab's copies remain protected. Recovery is explicit; a changed server version offers a separate recovered chapter or the latest saved chapter instead of overwriting another editor's work.

Restoring a copy keeps its source key until that exact tree is saved, since it may belong to another open tab. Identical copies are grouped into one recovery prompt; independently edited branches remain available. Already-saved copies are removed on the next load.

Copies expire after 30 days, stay on the current browser/device and are cleared on explicit logout/account switching. Temporary session lookup failures clear only the account cache. Viewer sessions cannot restore or edit copies. A blocked/full browser storage shows a warning and a JSON download; the last successfully stored copy remains intact. If both storage and network saving are unavailable, keep the page open or download the draft before leaving. No browser can guarantee crash recovery when it is prevented from storing the latest data.
