# Bots in internal Arena tournaments

## Teacher controls

Open **Admin → Tournaments** and create/open an internal Arena. Its **Computer players** panel is available on both the tournament management page and the teacher lobby.

- Choose a skill preset, optionally name the bot, and select **Add Bot**.
- Add up to 12 bots, including several at the same skill level. The six Play presets range from approximately 375 to 1600; these are estimates, not exact Elo settings. Sir Lem uses the existing Lichess-derived repertoire and personality.
- Students are matched with other available students first. An idle bot fills an otherwise unpaired student's slot. Bots do not play each other.
- **Force Matchmaking** accepts a student and an available bot, as well as two students.
- **Save Skill** changes the bot's next game; a game already underway retains its original difficulty and name.
- Remove an idle bot using **Remove → Confirm Remove**. A playing bot must finish first. Completed pairings retain the bot's original name.

Bots participate in Arena standings and the podium. Games award the usual 2/1/0 Arena points and are always casual, even in a rated Arena. Only human-vs-human games affect PvP ratings. A student's completed bot game is saved as a computer game for history and analysis; existing computer-game reward/quest rules continue to apply. Bots are separate participants, never fake student accounts.

## Gameplay and reliability

The server runs the bundled Stockfish engine with the existing Play personalities. Clients cannot submit bot moves or choose the engine's strength. The bot handles either color, promotion, normal automatic draws and clocks. Draw offers are hidden against bots; students can still resign.

Replies run after the HTTP response, with at most two calculations per server process. Database leases and version-checked updates prevent duplicate moves across server instances. Board/lobby refreshes recover interrupted work. No external engine service or new credentials are needed.

## Rollout

Apply `supabase/migrations/20260907012638_internal_arena_bots.sql` before deploying the application. It adds private bot data, bot participant columns, matching/lease RPCs and bot-aware Arena finalization. Existing human games keep their original representation. New tables/RPCs have browser-role privileges revoked and service-role access explicitly granted.

`next.config.ts` includes the existing Stockfish JavaScript and WASM files in the server deployment bundle. Do not omit either file when deploying.

Release order: verify the database migration first, then push the application to `main` for the existing Vercel production deployment.

## Verification

- Full Vitest suite, lint/TypeScript checks and production build.
- Real Stockfish tests for all six levels, legal moves and promotion.
- Server tests for either bot color, human move acknowledgment, duplicate work, recovery, resignation, timeout and completion without PvP ratings.
- `scripts/verify-arena-bots.mjs` executes the migration in a disposable PGlite database. It checks caps, eligibility, human/bot matching, idempotent scoring, leases, skill snapshots, removal/end rules and RLS/grants. Pass the installed `@electric-sql/pglite` module path as its argument; it never uses production credentials.
- Browser checks use real UI components with fixture data, including add/edit/remove, force pairing, student isolation and phone/tablet/desktop sizing. Production account mutations and a deployed engine round-trip remain rollout checks.
