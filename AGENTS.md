# The Chess Academy Project Context

Last reconstructed from the repository, Git history, live Supabase metadata, and prior project decisions on 2026-08-10.

This is the durable context file for future maintainers and Codex sessions. Read it before changing the application. Some older files under `docs/` describe earlier MVP plans or migrations and are useful historical references, but they are not always an exact description of the current production system. When this file and old planning notes differ, inspect the implementation and live Supabase schema before deciding which is authoritative.

## Project Overview and Purpose

The Chess Academy Quest Board is a mobile-first chess-learning and student-progress application. It is not a marketing site. It is intended to give students an RPG-like academy experience while giving the teacher one operational dashboard for classes, progress, rewards, submissions, quests, tournaments, Lichess activity, puzzle training, and avatar cosmetics.

The product currently serves three audiences:

- Students log in with Lichess, complete onboarding, see their dashboard, sync chess activity, complete quests, submit work, train puzzles, earn XP and Academy Coins, and customize an avatar.
- Parents may look up one public student profile by the student's exact public slug or Lichess username without creating an account. Public profiles should use a first name, nickname, or chess handle rather than requiring a full legal name.
- The teacher uses password-protected admin pages to manage students, classes, badges, quests, submissions, XP, coins, tournaments, resources, avatar items, and activity.

The long-term direction is a paid standalone chess-learning platform owned by The Chess Academy. It should become less dependent on Outschool rather than growing into an Outschool-specific class companion.

## Current Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 3
- Supabase Postgres, Row Level Security, Storage, RPC functions, and one deployed Edge Function
- Vercel hosting and Vercel Cron
- Lichess OAuth with PKCE plus Lichess public and authenticated APIs
- `chess.js` and `react-chessboard` for puzzle validation and board UI
- `csv-parse`, Node Zstandard streaming, and `tsx` for the local Lichess puzzle importer
- Vitest for unit tests
- OpenAI image generation from server routes for badge art
- Local seed/mock data and browser storage remain in several older or transitional areas

There is no Supabase Auth integration. Student identity is based on Lichess OAuth and custom HTTP-only cookies. Admin identity is based on an environment password and a server-readable session cookie.

## Repository and Production Identity

- GitHub repository: `https://github.com/lemsizzle/thechessacademy`
- Canonical deployment branch: `main`
- Production URL: `https://thechessacademy.vercel.app`
- Vercel project name: `thechessacademy`
- Vercel project ID: `prj_U9niNGcK1eJdHfGCAhwfl8KkD3Pt`
- Vercel team ID: `team_fPdvU9TNf37nFhkOVOErVDla`
- Supabase project ID: `yjtawpnflanerbodbieo`

The repository has also used a `fix-lichess-progress-sync` branch. Treat `main` as canonical unless a current task explicitly says otherwise. Vercel production is connected to GitHub and normally deploys changes pushed to `main`.

## Repository Structure

- `app/`: Next.js App Router pages, layouts, route handlers, and API endpoints.
- `app/app/`: public academy pages such as student directory, public profiles, leaderboard, quests, resources, badges, and tournaments.
- `app/student/`: authenticated student experience, including the combined dashboard, avatar store/studio, submissions, puzzle training, quests and Lichess progress, leaderboard, tournaments, and resources.
- `app/admin/`: authenticated teacher experience.
- `app/api/`: admin auth and CRUD, Lichess OAuth and synchronization, student APIs, tournaments, submissions, badges, avatars, and puzzle training.
- `components/`: reusable shells, navigation, cards, student/admin feature components, and UI primitives.
- `components/navigation.ts`: central sidebar/navigation definitions. Check this before adding a new menu item.
- `data/`: seed and mock data. Some production paths still fall back to these files when Supabase is unavailable or empty.
- `lib/`: data access, Supabase clients, authentication, Lichess logic, quest evaluation, XP calculations, avatar economy, tournament helpers, and shared types/utilities.
- `lib/supabase/client.ts`: public browser/anonymous Supabase client helper.
- `lib/supabase/admin.ts`: server-only service-role client. Never import it into a client component.
- `scripts/import-lichess-puzzles.ts`: local streaming Lichess puzzle importer.
- `supabase/migrations/`: versioned migrations for newer persisted features. Migration timestamps in the live project do not perfectly match every committed filename because some migrations were applied through remote tooling.
- `docs/`: setup notes, historical schemas, migrations, deployment/auth notes, Lichess notes, avatar specs, puzzle import instructions, and product plans. Verify old SQL against the live schema before running it.
- `tests/`: Vitest coverage, with emphasis on Lichess sync, XP, quests, and supporting utilities.
- `work/`: local asset-preparation workspace. Final avatar layers, source inputs, and non-sensitive processing scripts are currently untracked commit candidates; disposable previews, logs, and generated authorization payloads are ignored.

## Local Development Commands

Run commands from the repository root:

```powershell
npm install
npm run dev
```

Then open `http://localhost:3000`.

Verification commands:

```powershell
npm run lint
npm test
npm run build
```

In this repository, `npm run lint` runs Next route type generation followed by `tsc --noEmit`; it is primarily a TypeScript check. Always run the build before deployment because App Router route and server/client boundary problems may only appear there.

Local puzzle import:

```powershell
npm run import:lichess-puzzles -- "C:\path\to\lichess_db_puzzle.csv.zst" --fast
```

The importer also supports sampling and dry-run options. Never run the full import during a Vercel build or from a browser request.

## Environment Variables

Never place real values in this file, documentation examples, source code, or Git. `.env.local` and `.env*` are ignored by Git.

### Core deployment and Supabase

- `NEXT_PUBLIC_APP_URL`: deployed origin, for example the Vercel production URL; localhost in local development.
- `NEXT_PUBLIC_SUPABASE_URL`: public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anonymous key used by existing code.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: supported public-key alternative in some helpers.
- `SUPABASE_SERVICE_ROLE_KEY`: private server-only key for trusted writes and restricted reads.

### Admin authentication

- `ADMIN_PASSWORD`: teacher login password.
- `ADMIN_SESSION_SECRET`: stable secret used to derive and verify the admin session value. It must be identical across Vercel functions and deployments.

### Lichess

- `LICHESS_CLIENT_ID`: OAuth client identifier.
- `LICHESS_CLIENT_SECRET`: optional for the configured OAuth client flow.
- `LICHESS_REDIRECT_URI`: exact OAuth callback URL, currently `/api/auth/lichess/callback` on the relevant origin.
- `LICHESS_ENCRYPTION_SECRET`: server-only stable secret used to encrypt the Lichess access-token cookie.
- `LICHESS_OAUTH_SCOPES`: optional override. The application default is `puzzle:read team:read`.
- `LICHESS_TEAM_ID`: defaults to the academy team when omitted.
- `LICHESS_TOURNAMENT_CREATED_BY`: optional tournament creator filter.
- `LICHESS_TOURNAMENT_SYNC_INTERVAL_MINUTES`: tournament refresh interval.
- `LICHESS_TEAM_TOURNAMENT_MAX`: optional fetch limit.
- `LICHESS_QUEST_TIMEZONE`: optional timezone used in quest calculations.

### Scheduled tasks and integrations

- `CRON_SECRET`: protects the Vercel tournament cron route.
- `OPENAI_API_KEY`: private server-only badge-art and analysis key.
- `OPENAI_BADGE_IMAGE_MODE`: optional badge generation mode; `mock` intentionally enables placeholders.
- `OPENAI_IMAGE_MODEL`: optional image model override. The current default path uses `gpt-image-1`.
- `PUZZLE_SESSION_SECRET`: private puzzle-answer session signing secret; code may fall back to `ADMIN_SESSION_SECRET`.
- `OUTSCHOOL_WEBHOOK_SECRET`: reserved for the placeholder Outschool integration.

### Local puzzle importer overrides

- `PUZZLE_IMPORT_ENV_FILE`
- `PUZZLE_IMPORT_RATING_MIN`
- `PUZZLE_IMPORT_RATING_MAX`
- `PUZZLE_IMPORT_MIN_POPULARITY`
- `PUZZLE_IMPORT_MIN_PLAYS`
- `PUZZLE_IMPORT_PER_THEME`
- `PUZZLE_IMPORT_BATCH_SIZE`
- `PUZZLE_IMPORT_PROGRESS_EVERY`

`VERCEL_OIDC_TOKEN` may be created locally by Vercel tooling. Treat it as private and machine-specific.

## Supabase Architecture

Supabase is the production source of truth for the main student, reward, quest, submission, avatar, and puzzle-training systems. The service-role client is used only in server routes/actions. Public reads use the anonymous client and RLS.

The central record is `students`. Its UUID is referenced by most student-owned records. Student deletion should cascade through related rows where the schema defines `ON DELETE CASCADE`; the next Lichess login for the deleted identity should go through onboarding again.

### Important live tables

- `students`: display/public identity, class group, base XP, level, active state, Lichess identity, Lichess baselines, and synchronized summary fields.
- `badges`: badge definitions, tier/category, XP reward, prompt/art fields, and generation status.
- `student_badges`: unique earned badge assignment by student and badge.
- `xp_events`: durable XP ledger for teacher, badge, quest, and other persisted XP awards.
- `academy_quests`: current durable quest definitions used by the newer quest system.
- `student_quest_attempts`: each started quest window, status, timestamps, and completion state.
- `lichess_quest_progress`: synchronized per-student, per-quest, per-window progress snapshots.
- `quest_completion_events`: durable completion/expiration history.
- `student_game_submissions`: student-submitted games for review or analysis.
- `student_score_submissions`: submitted puzzle scores and teacher review state.
- `lichess_sync_state`: server-side sync/cooldown/rate-limit state by student.
- `student_lichess_accounts`: durable Lichess profile/activity snapshot used to keep pages consistent. It does not store OAuth access tokens.
- `avatar_items`: catalog, category/layer, rarity, price, asset URL, visibility, and grant conditions.
- `student_inventory`: owned avatar items.
- `student_avatar`: equipped item IDs and appearance state.
- `student_wallets`: Academy Coin balance and Lichess XP-to-coin synchronization marker.
- `coin_transactions`: immutable coin earning, spending, refund, and teacher-adjustment ledger.
- `store_purchases`: purchase records and refund state.
- `chess_puzzles`: imported Lichess puzzle catalog with server-only answer data.
- `student_puzzle_attempts`: puzzle-training attempt history.
- `badge_generation_jobs`: planned generation-job persistence; currently not consistently used by the active image route.
- `activity_events`: legacy/general activity table. Newer activity feeds also aggregate the purpose-specific ledgers above.
- `quests` and `student_quests`: original MVP quest tables. The newer active quest flow uses `academy_quests`, attempts, progress, and completion events.

As of the 2026-08-10 inspection, RLS is enabled on all application tables. Public read policies exist for appropriate profile/progress data, while sensitive write and answer data is restricted to trusted server code. `chess_puzzles` and puzzle answers must remain server-only.

### Important database functions and triggers

- Positive `xp_events` fire `award_academy_coins_after_xp_event` and the `award_academy_coins_for_xp_event` function.
- `grant_academy_coins(...)` writes idempotent coin transactions.
- `sync_lichess_xp_coins(...)` grants only the positive delta for derived cumulative Lichess XP.
- `purchase_avatar_item(...)` validates ownership, price, and wallet balance in the database.
- Updated-at triggers cover students, badges, quests, academy quests, sync state, Lichess account snapshots, avatar records, wallets, and puzzle records.

Idempotency keys are essential. Removing or bypassing them can double-award coins or rewards when a sync or route is retried.

### Supabase Storage and Edge Functions

- The live public Storage bucket observed on 2026-08-10 is `avatar-assets`.
- Badge generation code creates or reuses a public `badge-art` bucket when needed; do not assume it already exists in every environment.
- A live Edge Function named `avatar-storage-bootstrap` exists and requires JWT verification. Production version 3 is intentionally disabled and returns HTTP 410. Its recovered source is stored at `supabase/functions/avatar-storage-bootstrap/index.ts`; do not redeploy it unless intentionally changing that disabled behavior.

### Migration cautions

- Do not blindly rerun `docs/supabase-schema.sql` against production. It was designed for an early/fresh setup and has companion fix files.
- Prefer versioned, idempotent migrations in `supabase/migrations/` for new changes.
- Inspect the live schema and migration list before applying SQL. Some live migration timestamps differ slightly from the committed filenames because remote tooling generated the applied versions.
- Do not create duplicate tables for features that already have a durable successor, especially `quests` versus `academy_quests`.

## Authentication and User Roles

### Admin authentication

Admin login posts to `/api/admin/login`, compares the supplied value with `ADMIN_PASSWORD`, and sets the `quest_board_admin_session` cookie. The cookie is HTTP-only, secure in production, `sameSite: "lax"`, scoped to `/`, and lasts seven days. Logout clears the same cookie through `/api/admin/logout`.

The session verifier derives a deterministic SHA-256 value from `ADMIN_SESSION_SECRET` and uses Web Crypto-compatible code. Do not generate a random secret at runtime. Admin pages are protected by the admin layout/server checks, and admin API routes must independently verify the same session. A localStorage marker may exist for old UI compatibility, but it is never authoritative authentication.

### Student authentication

Student login uses Lichess OAuth with PKCE:

- Start: `/api/auth/lichess/start`
- Callback: `/api/auth/lichess/callback`
- Logout: `/api/auth/logout`

OAuth state, verifier, and context use short-lived HTTP-only cookies. The Lichess access token is encrypted using `LICHESS_ENCRYPTION_SECRET` and remains in an HTTP-only cookie. It must never be returned to browser JavaScript or stored in public Supabase columns.

The student app session cookie is `quest_board_student_session` and lasts fourteen days. At the time of this review, its payload is base64url JSON rather than a cryptographically signed token. Routes mitigate this by rechecking the live student row and Lichess identity, but signing or replacing this session format is a security priority before a paid production launch.

There are no parent accounts, student passwords, or Supabase Auth users yet.

## Lichess OAuth and Data Integration

The integration has two data paths:

- Public Lichess APIs provide profile ratings and public game exports.
- The authenticated `puzzle:read` scope provides puzzle activity. `team:read` supports team-related access.

Game export and public ratings do not require a special OAuth read-games scope. Do not request nonexistent or unnecessary scopes just to make the authorization page look broader.

The durable `student_lichess_accounts.account_data` snapshot should be the common read source for student and teacher pages after synchronization. This was added to prevent one page from showing fresh progress while another shows stale local state.

Current synchronization behavior and rules:

- Student login and the authenticated shell trigger a sync, subject to a short client cooldown.
- Game export is NDJSON and includes rated rapid and blitz games. A finished game under ten moves does not count for quests or activity rewards.
- Puzzle activity is fetched with the authorized token, paginated, and deduplicated by puzzle ID.
- Sync state is persisted in `lichess_sync_state` so different serverless instances share cooldown and rate-limit information.
- A Lichess 429 response must preserve the previous successful snapshot and progress. It must never replace known progress with zero.
- Teacher "Sync All" can fetch public games and ratings, but private puzzle activity depends on an active authorized student token. Tokens are currently browser-cookie based, not stored for background server use.
- First-login baselines ensure games, puzzles, ratings, and tournament points from before the student's first academy login do not create XP.

Historically this has been the most fragile subsystem. Stable game IDs, puzzle IDs, quest windows, first-login baselines, and the persisted account snapshot are deliberate decisions. Avoid replacing them with totals scraped from a profile or with browser-only counters.

## Arena Tournament Integration

Only Lichess Arena tournaments are supported. Swiss tournaments were intentionally removed from the product scope.

Current academy team:

- Team URL: `https://lichess.org/team/outschool-battleground`
- Default team ID: `outschool-battleground`
- Student-facing team entry code: `good game`

The public tournament experience defaults to upcoming tournaments, uses countdowns rather than local start-time displays, explains how to join the team, and shows at most the last six finished tournaments.

The app uses Lichess team Arena and tournament-results endpoints, with NDJSON result parsing. Tournament XP rules in the current implementation include participation, points, podium bonuses, and a weekly cap. Only tournament activity after first login should count.

Important limitation: tournament definitions, imports, results, and pending awards are not yet backed by live Supabase tournament tables. Much of this state is held in module memory or browser localStorage, and the server route can fall back to mock tournaments. The daily Vercel cron refreshes `/api/cron/lichess-team-tournaments` at 12:00 UTC, but an in-memory cache is not durable across Vercel function instances. Persist Arena tournaments and results before treating this feature as billing-grade or historically reliable.

## Student Onboarding and Profile Behavior

After each successful Lichess callback:

1. Look up a student by `lichess_id`, then by case-insensitive `lichess_username`.
2. If the row exists, establish the student session and go to `/student`.
3. If the row was deleted or never existed, ignore any stale `student_id` and go to `/student/onboarding`.
4. Onboarding shows the authenticated Lichess username, asks for display name and class group, generates a public slug from the handle, inserts the student row, saves the Lichess identity, and establishes zeroed first-login baselines.

New students start with zero academy XP from Lichess history. Historical games, puzzles, ratings, and Arena points are the baseline, not a retroactive award. Once linked, only new eligible activity earns rewards.

The authenticated student dashboard and former "My Profile" page were intentionally consolidated. The sidebar should retain the same student shell on every student page; navigation must not send the user into the public shell or require login again. Public parent lookup reveals only the requested student's public profile and must not expose a browsable private roster.

## Admin Functionality

The teacher dashboard currently includes:

- Student create/edit/delete, class filtering, Lichess sync, XP adjustment, Academy Coin adjustment, badge award/removal, and detailed progress/activity.
- Submission review for games and puzzle scores, with the ability to award XP, badges, or quest completion.
- Supabase-backed badge create/edit/delete and on-demand badge-art generation.
- Quest creation/edit/delete, Lichess-linked conditions, live toggles, completion links, and progress review.
- Tournament management and Lichess team refresh, with persistence limitations noted above.
- Class and resource editors, currently with local/browser persistence limitations.
- Avatar item catalog management, asset URL entry, visibility, price, rarity, and grants.
- Consolidated student activity feed.
- A game analyzer, which is useful but still partly local and does not have a complete production analysis schema.

Admin navigation is grouped into teacher work, setup, and tools. The public/student side must never display teacher-only links or a "Manage Student" action.

## Badges and Achievement System

Badge definitions use Supabase UUIDs. `student_badges` also expects UUIDs. Legacy string IDs such as `tactic-skewer-bronze` must be resolved or upserted to the corresponding Supabase badge before assignment; never insert a legacy string into a UUID foreign key.

Database tiers are `C`, `B`, `A`, and `S`. The UI may present these as Bronze, Silver, Gold, and Platinum. Keep the mapping explicit. Database category constraints reflect the established category set, so new UI labels such as Concept Badges may need a compatibility mapping or a deliberate migration.

The badge gallery groups tactic families rather than showing a cluttered card for every tier. Tactic badges use short descriptions of the tactic. Students see earned badges on their dashboard; the standalone badge gallery was removed from authenticated student navigation.

Admin badge art behavior:

- Build prompts from badge name, description, category, tier, XP, unlock requirement, visual theme, and an editable prompt override.
- Generate only after the admin clicks Generate or Regenerate. Never generate on page load.
- Prefer emblem-like, centered, text-free art; badge names, tiers, and XP remain HTML UI.
- The OpenAI key and service-role key stay server-side.
- The active route requests three `1024x1024` images and uploads generated bytes to Supabase Storage.
- Existing images are reused until explicitly regenerated.
- Mock generation should occur only when intentionally configured, not silently in production.

`badge_generation_jobs` exists for durable job tracking but the current route does not consistently write it. Treat full generation auditing/retry tracking as partial work.

## XP, Levels, and Rewards

Lifetime XP is used for levels, leaderboard position, and progression. Academy Coins are a separate spendable balance. Purchases never reduce lifetime XP.

Current level curve and titles:

| Level | XP | Title |
| --- | ---: | --- |
| 1 | 0 | Pawn Initiate |
| 2 | 100 | Knight Scout |
| 3 | 275 | Bishop Adept |
| 4 | 550 | Rook Guardian |
| 5 | 950 | Tactical Mage |
| 6 | 1500 | Checkmate Captain |
| 7 | 2250 | Endgame Sage |
| 8 | 3250 | Royal Strategist |
| 9 | 4600 | Academy Champion |
| 10 | 6400 | Grandmaster Hero |

The curve intentionally becomes harder at higher levels. Student card visuals and nameplate backgrounds become more elaborate by level.

Current Lichess activity XP rules:

- Rated rapid game played: 5 XP total.
- Rated rapid game won: 10 XP total, not 5 plus another 10.
- Rated blitz game played: 2 XP total.
- Rated blitz game won: 5 XP total, not 2 plus another 5.
- Correct Lichess puzzle: 2 XP.
- Established rapid/blitz rating milestones: 15 XP per 100 points above the configured floor, capped by the implementation.
- Puzzle rating milestones: 10 XP per 100 points above the configured floor, capped by the implementation.
- Provisional rapid/blitz ratings do not grant rating XP. Rated games still count even while the rating is provisional.

The persisted `students.total_xp` is base/lifetime event XP. Displayed totals and the leaderboard add derived cumulative Lichess XP through shared helpers. Do not independently recalculate totals in each page.

One XP should create one Academy Coin. Existing students were backfilled once using idempotent transactions. New positive `xp_events` award matching coins through the database trigger, while derived Lichess XP uses `sync_lichess_xp_coins`. Idempotency keys prevent retries from minting duplicates. Coin spending and teacher adjustments must appear in `coin_transactions` and the activity feed.

## Quests

The active quest model uses `academy_quests`, `student_quest_attempts`, `lichess_quest_progress`, and `quest_completion_events`.

Product decisions:

- A student explicitly clicks Start before progress counts.
- Students may start any number of quests at the same time.
- Daily quests run for 24 hours from that student's Start click.
- Weekly quests run for seven days from that student's Start click. They do not reset on Monday.
- An expired repeatable quest becomes immediately available to start again.
- Started/live quests appear first on the student page.
- Finished history is a compact list of the last ten attempts, including success/failure face, score where relevant, XP/coins, and finish date.
- Successfully completed quests use a green check/happy state; unsuccessful expirations use a sad state.
- Live quest completion links should appear on student cards and be validated as safe external URLs.
- If teacher approval is disabled, a qualifying quest should complete and award XP automatically.

Supported Lichess condition families include played rated games, played rapid/blitz games, rapid/blitz/rated wins, puzzle attempts/correct/accuracy/theme totals, Arena points, tournament participation, rating peaks, and manual completion.

Quest synchronization has had repeated production bugs. The important invariants are:

- Progress is keyed to the exact student, quest ID, and attempt window.
- Starting a new attempt starts at zero even if an older window had progress.
- A failed or rate-limited fetch preserves the last successful value.
- Every page reads the same durable progress snapshot instead of keeping independent local counters.
- Completion and reward writes are idempotent.
- Expired or completed attempts cannot be reopened by a stale client save.

There is a current design inconsistency to resolve: parts of the evaluation path automatically approve generated awards even though the quest editor and review UI still expose an approval-required concept. Before changing behavior, decide whether approval is per quest and then enforce that decision in one server-side completion transaction.

## Puzzle Training and Lichess Puzzle Database

Puzzle Training is separate from Lichess puzzle-activity synchronization. It is an in-app training mode at `/student/training` using the imported Lichess puzzle database.

Current first version:

- Themes: Mixed, Fork, Pin, Skewer, and Mate in 1.
- Ten-puzzle sessions.
- Three incorrect moves end survival mode.
- The server applies the first UCI setup move and the student begins from the next move.
- Solution lines and answers stay server-side. The browser receives a signed session token and submits moves for server verification.

The intended puzzle catalog is imported locally from `lichess_db_puzzle.csv.zst` using a streaming importer. It validates FEN and every UCI move with `chess.js`, filters standard active positions, supports fast fill or bounded reservoir sampling, upserts in batches, and is safe to rerun using `lichess_puzzle_id` as the unique conflict key.

Default import targets are up to 2,500 each for fork, pin, skewer, and mate-in-one with rating 600-2200, popularity at least 70, and at least 50 plays. A puzzle may satisfy multiple targets but is stored once.

As of 2026-08-10, the live `chess_puzzles` and `student_puzzle_attempts` tables were empty. A previous local dry-run found a qualifying set, but the production import has not been reliably completed or its data was later cleared. The compressed source archive is intentionally ignored and is not currently present in this workspace.

## Custom Avatar System

The avatar system is Supabase-backed. The student Avatar Studio and store were intentionally combined so previewing, purchasing, equipping, and saving happen in one place. The old `/student/armory` route is legacy compatibility and should not become a second competing experience.

Core tables are `avatar_items`, `student_inventory`, `student_avatar`, `student_wallets`, `coin_transactions`, and `store_purchases`. Purchases are validated server-side or through the database RPC using the database price, not a client-provided price. Students may equip only owned or default-free items.

Items should display newest to oldest. Public student pages and the authenticated dashboard should render the student's equipped avatar.

### Layer contract

The renderer uses a fixed logical layer order:

| Category | Layer |
| --- | ---: |
| background | 0 |
| aura | 5 |
| base_face | 10 |
| skin_tone | 12 |
| eyes | 20 |
| eyebrows | 22 |
| mouth | 24 |
| hair | 30 |
| facial_hair | 32 |
| clothing | 40 |
| headwear | 50 |
| glasses | 55 |
| accessory | 60 |

The torso is a permanent fixture tied to skin tone. It must not disappear when clothing is removed, and it must not be owned by a replaceable face layer.

### Production asset requirements

- Exactly `1024x1024` pixels.
- Transparent PNG with RGBA color and sRGB profile.
- Every asset uses the full uncropped canvas, even if most pixels are transparent.
- No automatic trimming, bounding-box export, resizing, or per-item positioning.
- All layer images share the same origin, face center, shoulders, and scale.
- The renderer stacks full-canvas images at identical bounds with `object-fit: fill`.
- Mobile layouts resize the avatar container; they do not change layer coordinates.
- Placeholder art can be simple. High-quality assets must remain replaceable through the admin catalog and Supabase Storage without code changes.

The logical editor preview uses a shared coordinate system. Do not introduce asset-specific CSS offsets as a shortcut; that makes replacement art fragile.

### Economy

Default parts are free and automatically owned. Purchasable price guidance is centralized in `lib/avatar/economy.ts`:

- Common: 5-15 coins.
- Uncommon: 20-35 coins.
- Rare: 40-65 coins.
- Epic: 75-110 coins.
- Legendary: 125-175 coins or achievement-only.

Achievement-only items have no purchasable price and are granted by an achievement or admin. Some current catalog rows may not match the target ranges, so economy cleanup should update data through the admin tool or a migration rather than duplicating prices in components.

## Class and Resource Data

Class group names currently come from seeded class data plus active `students.class_group` values. Class metadata, meeting links, and some editor state are still saved to browser localStorage rather than a Supabase `class_groups` table. This means a class edit on one browser may not appear on another device.

Resources have a similar transitional local/seeded implementation. External resources should open in a new tab with safe `noopener/noreferrer` behavior. The student label is "Resources FAQ", and the FAQ is collapsed by default.

Outschool synchronization is not production-ready. The existing endpoint is a placeholder/mock registration flow, not a verified official roster webhook. Do not build new core architecture around Outschool because the long-term product is intended to stand alone.

## Submission and Analysis Flow

"Submit Work" and "My Submissions" were intentionally combined so students submit and see their history on one page. Puzzle score submission asks for tactic theme, score, and comment. Game submissions ask for a Lichess game link and relevant review details.

Submissions are persisted to `student_game_submissions` and `student_score_submissions`. Teacher review can approve/reject and award XP, a badge, or quest completion. The server must identify the student from the authenticated cookie rather than trusting a client-supplied student ID.

The game analyzer remains partly local and does not have a complete durable analysis-job schema in live Supabase. Automatic tactic detection from Lichess games was intentionally removed; students submit games for review or analysis instead.

## Current Subscription and Business Direction

Payments and memberships are not implemented. No billing provider, prices, renewal cadence, trial policy, cancellation policy, or entitlement schema has been selected.

The planned membership structure is:

1. Tournaments-only membership: access to academy Arena events and the tournament community experience without instructional classes.
2. Instructional classes plus tournaments membership: class enrollment and instruction together with tournament access.

The class program should support a beginner-through-advanced learning path. Exact level names, curriculum boundaries, placement rules, and schedule are not yet reliably encoded in the repository. Existing `class_group` values are current cohorts/schedules and should not automatically be treated as skill levels or subscription entitlements.

### Existing-student transition principles

When memberships are introduced:

- Preserve each student's UUID, public profile, Lichess link and baseline, XP, level, badges, Academy Coins, avatar inventory/equipment, quest history, submissions, and tournament history.
- Do not require existing students to repeat onboarding or reset progress.
- Add membership and entitlement records alongside students rather than replacing student identities.
- Give existing students an explicit transition/grandfathering state so access can be reviewed before enforcement.
- Separate class cohort, skill level, and paid entitlement into different fields/tables.
- Decide pricing, grace period, grandfathering duration, billing provider, family handling, and failed-payment behavior before implementing access gates.

## Important UX and Product Decisions

- This is an application, not a long marketing website.
- Visual style is a dark magical chess academy with RPG/anime/shonen energy, kid-friendly without being childish.
- The interface is mobile-first and must preserve access to navigation at narrow desktop widths. Student and teacher shells use a sidebar with a responsive menu.
- The home page is streamlined: welcome/instructions, direct Lichess login, exact parent profile lookup, and a collapsed FAQ. Teacher login is reached by the `/admin` or `/admin-login` address rather than a prominent public CTA.
- Use the label "Log in" consistently.
- Student Lichess login should go directly to Lichess and return to the correct dashboard or onboarding state without a secondary login page.
- Student dashboard and profile are one experience.
- Quests and Lichess progress are one student section with one synchronization action.
- Submitting work and viewing submissions are one section.
- Avatar preview, purchase, inventory, and equipment are one studio/store.
- Classes are teacher-managed and are not a student navigation section.
- Student navigation does not need a separate badge-gallery link; earned badges live on the dashboard.
- Public profiles should avoid full legal names.
- Destructive actions use an explicit confirmation after Delete is clicked.
- Buttons have visible pressed states.
- External resources and Lichess registration/team links open in a new tab where appropriate.
- Students may start multiple quests concurrently.

## Features Currently Working

The following are implemented and backed by production-oriented code, though every release still requires regression testing:

- Next.js App Router application deployed through GitHub to Vercel.
- Password/cookie-based protected admin shell and logout.
- Lichess OAuth PKCE student login, onboarding, stale/deleted profile recovery, and logout.
- Supabase-backed students, badge CRUD/awards, XP ledger, quest definitions/attempts/progress, submissions, Lichess snapshots, avatars, inventory, wallets, and coin ledger.
- Student dashboard with Lichess summary, XP/level, activity, earned badges, quest status, and avatar.
- Teacher student editor with class filtering, XP/coin controls, badge controls, and progress/activity views.
- Public/student leaderboards using live student data and shared XP calculations.
- Direct parent lookup for a public student profile.
- On-demand server-side OpenAI badge generation and Supabase Storage upload path.
- Arena list/results parsing and countdown UI, subject to persistence limitations.
- Local, streaming, idempotent Lichess puzzle import tooling.
- In-app puzzle-training UI and secure server-side move verification architecture.
- Responsive student/admin navigation, including narrow-width menu access.

## Known Bugs and Fragile Areas

- Lichess quest progress and XP synchronization has been repeatedly fragile, especially after 429 rate limits, across page-specific caches, and around attempt windows. Test it end to end after any change.
- Teacher bulk sync cannot reliably refresh authenticated puzzle activity when the student's encrypted Lichess token exists only in that student's browser cookie.
- The custom student session cookie is not signed. This is a security concern for a paid platform.
- Public data helpers still fall back to mock data when Supabase is missing, errors, or returns an empty result. Empty production tables can therefore appear to contain deleted/sample records.
- Tournament state is not durable in Supabase and may be held in Vercel function memory or localStorage. Mock tournament fallback can hide a production fetch failure.
- Class configuration and resource edits are not fully persisted to Supabase.
- The quest approval setting and current automatic approval/evaluation path are not fully consistent.
- Quest completion, XP, and coin award logic spans browser state, API routes, database triggers, and sync helpers. It needs a single transactional server path.
- `badge_generation_jobs` is not consistently populated.
- The live puzzle catalog is empty, so the in-app trainer cannot provide the intended production content until an import is completed.
- Legacy tables, routes, and localStorage keys coexist with newer durable systems and can produce divergent displays.
- Some avatar catalog prices may be outside the intended economy ranges.
- The recovered `avatar-storage-bootstrap` source is not committed yet and should be included in the migration commit.
- Screenshot evidence for submissions can be represented as a URL, but a complete student upload workflow is not clearly productionized.

## Partially Implemented Features

- Durable Arena tournament storage and award history.
- Real class-group management and class links in Supabase.
- Durable resource/FAQ management in Supabase.
- Outschool roster synchronization. Current behavior is a placeholder and should not become a long-term dependency.
- Background/durable Lichess token strategy for teacher-driven puzzle sync.
- Full badge generation job tracking and retries.
- Puzzle catalog production import and populated training attempts.
- Durable game-analysis jobs/results.
- Clean removal of all mock fallback and legacy localStorage state.
- Uniform transactional quest completion and approval behavior.

## Planned but Not Yet Implemented

- Paid memberships and billing.
- Tournaments-only and instruction-plus-tournaments entitlements.
- Beginner-through-advanced program and placement model separated from class schedule.
- Existing-student membership transition/grandfathering workflow.
- Parent accounts and family management.
- A production student/session security model appropriate for paid access.
- Reliable background synchronization/queueing for Lichess activity.
- Production monitoring and alerting for sync failures, reward duplication, and cron failures.
- High-quality replacement avatar asset library. The architecture is meant to accept future assets without code changes.

## Technical Debt

- Consolidate Supabase mapping and data access so each entity has one canonical server representation.
- Remove `shouldUseMock` fallbacks from live production reads after empty/error states are safely distinguished.
- Replace browser-local admin stores with Supabase tables and audited server routes.
- Consolidate quest evaluation, completion, XP, badge, and coin writes into idempotent database transactions/RPCs.
- Sign the student session or move to a mature server-verified auth/session system without disrupting Lichess identity.
- Persist tournament cache/results/imports and eliminate silent production mock fallback.
- Keep the recovered Edge Function source under version control and manage future changes with versioned deployment files.
- Reconcile old `quests`/`student_quests` and other legacy files after all callers use `academy_quests`.
- Add integration tests against a disposable Supabase branch for onboarding, deletion/re-onboarding, XP/coin awards, quest windows, badge awards, purchases/refunds, and submissions.
- Add structured observability around Lichess request IDs, cooldowns, snapshot dates, and retained-stale-data decisions.
- Keep route authorization checks centralized and consistent across admin and student APIs.

## Do Not Change Without a Good Reason

- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, admin/session secrets, cron secrets, or Lichess tokens to the browser.
- Do not replace the current Supabase project, Vercel project, GitHub repository, or authentication systems by creating duplicates.
- Do not count Lichess activity from before a student's first academy login.
- Do not count provisional rapid/blitz ratings for rating XP; rated games still count.
- Do not reset lifetime XP when coins are spent.
- Keep the one-XP-to-one-coin relationship and idempotent coin ledger unless the product owner explicitly changes it.
- Do not write legacy string badge IDs into UUID foreign keys.
- Do not reset quest progress to zero when Lichess returns 429 or another transient error.
- Keep quest progress bound to the student's explicit attempt window.
- Keep puzzle answers and the service-role puzzle catalog server-only.
- Do not generate badge images on normal page load.
- Keep Lichess access tokens in encrypted HTTP-only server-readable cookies; never place them in localStorage or public tables.
- Preserve the fixed avatar layer coordinate contract and permanent skin-tone torso.
- Do not split intentionally consolidated student pages back into duplicate dashboard/profile, submit/history, quest/progress, or avatar/store experiences.
- Do not make the public home page into a long sales landing page.
- Do not make Outschool a required architectural dependency for the standalone platform.

## Deployment Setup

Normal deployment flow:

1. Run lint, tests, and the production build locally.
2. Commit only intentional files.
3. Push `main` to the GitHub repository.
4. GitHub integration triggers a Vercel production deployment.
5. Verify the production home page, student login/callback, onboarding, student dashboard, admin login/navigation, Supabase reads/writes, and any changed feature.

Vercel environment variables are managed separately from `.env.local`; they are not copied by Git. Production OAuth must use:

`https://thechessacademy.vercel.app/api/auth/lichess/callback`

The current Vercel Cron configuration is in `vercel.json`. The cron route must validate `CRON_SECRET`.

The local `.vercel/project.json` links the checkout to the existing Vercel project. It is intentionally ignored by Git and can be recreated with Vercel linking tools on another computer.

## GitHub, Vercel, and Supabase Relationship

- GitHub stores application code, tests, migrations, and documentation.
- Vercel builds the GitHub `main` branch and hosts the Next.js server/client runtime.
- Vercel environment variables point the deployed app at the existing Supabase and Lichess integrations.
- Supabase stores durable production application data, avatar assets, database functions/triggers, and the deployed avatar bootstrap Edge Function.
- Supabase service-role operations happen only in Next.js server routes/actions or trusted local scripts.
- Browser/public reads use the anonymous/publishable key under RLS.
- Git does not contain production data, Storage objects, Vercel environment values, OAuth cookies/tokens, or browser localStorage state.

## Local-Only State and Migration Notes

At the time this file was created, this checkout contained local state that is not safely reproduced by cloning GitHub:

- `.env.local`: machine-local secrets and URLs. Copy its values securely or recreate them from Vercel/Supabase/Lichess settings. Never commit it.
- `.vercel/project.json`: local Vercel project link metadata. It contains project/team IDs rather than application secrets, but it is ignored and will need to be recreated.
- `components/student/AvatarStudio.tsx`: 39 lines of uncommitted local changes related to the newest-items avatar-store work. Review and commit or otherwise migrate this work separately.
- `work/avatar-assets/`: 49 local files totaling about 15.2 MB. The 16 final layers, 11 source inputs, and 17 non-sensitive processing scripts are untracked preservation candidates. Three disposable previews and two generated files containing authorization material are explicitly ignored. The public repository should only receive artwork whose provenance and public redistribution rights are acceptable.
- `supabase/functions/avatar-storage-bootstrap/index.ts`: recovered from live production version 3 on 2026-08-10 and currently uncommitted.
- Browser localStorage may contain class, resource, tournament, game-analysis, and older admin state that will not move to another browser or computer.
- Vercel CLI, GitHub CLI, Supabase, and Codex connector authorization are machine/user-session credentials and must be reconnected.
- The Lichess puzzle archive is intentionally not stored in Git and was not present in this checkout.
- `.gitrepo/` is an ignored local metadata/backup directory. It is not needed when the normal `.git` history and GitHub remote are healthy unless the owner knows it contains a specific recovery state.

Do not migrate `node_modules`, `.next`, logs, or TypeScript build info; reinstall or rebuild them.

## Suggested Next Development Priorities

1. Preserve the current local avatar changes and source assets by intentionally committing the code and securely archiving the ignored art after review.
2. Remove production mock resurrection from student, leaderboard, badge, quest, and tournament reads while keeping honest loading/empty/error states.
3. Make quest completion one idempotent server/database transaction that writes progress, completion, XP, coins, badges, and activity consistently.
4. Stabilize Lichess synchronization with one canonical snapshot, explicit 429 backoff, durable request metadata, and tests for first-login baselines and wins/game counts.
5. Persist classes, resources, Arena tournaments/results, and tournament awards in Supabase; remove browser-only admin persistence.
6. Complete the production puzzle import and verify the trainer end to end against real rows.
7. Strengthen student session signing and authorization before adding paid memberships.
8. Design membership, entitlement, class-level, and existing-student transition tables before selecting a billing provider or adding checkout.
9. Commit the recovered Supabase Edge Function source and keep future function changes versioned.
10. Add disposable-branch integration tests and production monitoring for the highest-risk reward/sync flows.

## Historical Context That Is Not Fully Reconstructable

The repository and prior task history do not establish final answers for:

- Subscription prices, billing provider, billing cadence, trials, refunds, or launch date.
- Exact names/curriculum/placement rules for beginner, intermediate, and advanced classes.
- Which existing students receive which future membership tier, for how long, and whether they are grandfathered.
- A final production relationship with Outschool or a supported official roster API.
- Whether teacher approval should be required for particular quest categories after automatic verification.
- Whether the current live avatar prices outside the target economy are intentional.
- Whether the empty production puzzle catalog was never imported or was deliberately cleared.
- The complete contents of browser localStorage on other devices.

Do not silently invent these decisions. Ask the product owner when they become relevant.

## Instructions for Future Codex Sessions

- Read `AGENTS.md` before making changes.
- Inspect the existing implementation before replacing or redesigning features.
- Preserve existing working behavior unless explicitly asked to change it.
- Use the existing GitHub, Vercel, and Supabase integrations when useful.
- Avoid creating duplicate Supabase projects, databases, auth systems, or unnecessary replacement infrastructure.
- Never expose or commit secrets.
- Prefer fixing the existing implementation over rebuilding features from scratch.
- Clearly explain major architectural changes before implementing them.
- Keep the project aligned with the long-term goal of turning The Chess Academy into a paid standalone chess-learning platform rather than an Outschool-dependent class site.
- Check Git status before editing and preserve unrelated user changes.
- Treat old docs and mock files as historical or fallback context, not automatically as production truth.
- Verify live schema and migration history before running SQL.
- Use service-role Supabase access only in server-side code or trusted local scripts.
- Run TypeScript checks, tests, and the production build after implementation work.
- For sync/reward changes, test the complete path from Lichess or student action through persisted progress, XP, coins, activity, and every student/teacher view.
- Do not commit or push unless the user explicitly asks.
