# Bots in internal Arena tournaments

## Teacher controls

Open **Admin → Tournaments** and create/open an internal Arena. Its **Computer players** panel is available on both the tournament management page and the teacher lobby.

- Drag the **Bot skill level** slider, optionally name the bot, and select **Add Bot**. Each existing bot has its own slider and **Save Skill** button. Arrow keys adjust the slider; Home/End select its limits.
- Add up to 12 bots, including several at the same skill level. The slider has 50 settings, approximately 375–1600 in 25-point steps. These are estimates, not measured Elo ratings. **Choose a named preset** still offers all six original Play bots, including Sir Lem with his Lichess-derived repertoire and personality.
- Students are matched with other available students first. An idle bot fills an otherwise unpaired student's slot. Remaining available bots pair with each other.
- **Force Matchmaking** accepts any two available players: two students, a student and a bot, or two bots.
- **Save Skill** changes the bot's next game; a game already underway retains its original difficulty and name.
- Remove a bot at any time using **Remove → Confirm Remove**. It leaves the queue immediately; a game already underway finishes normally, then the bot leaves the standings. It cannot be paired again. Completed pairings retain its original name.
- Nicknames display exactly as entered, without an appended “BOT” label.

Bots participate in Arena standings and the podium. Games award the usual 2/1/0 Arena points and are always casual, even in a rated Arena. Only human-vs-human games affect PvP ratings. A student's completed bot game is saved as a computer game for history and analysis; existing computer-game reward/quest rules continue to apply. Bot-only games update both bots' Arena scores without creating student history, ratings, XP, or quest progress. Bots are separate participants, never fake student accounts.

## Gameplay and reliability

The server runs the bundled Stockfish engine with the existing Play personalities. Clients cannot submit bot moves or choose the engine's strength. The bot handles either color, promotion, normal automatic draws and clocks. Draw offers are hidden against bots; students can still resign.

Custom `arena-<rating>` difficulty IDs interpolate neighboring presets' calculation time, tactical awareness, move-quality discipline, personality and error-band probabilities. Both the API and database accept only the 50 supported values. Custom strengths do not use Sir Lem's recorded repertoire, which would bypass strength selection; select his named preset to retain the clone. Existing preset IDs and saved games are unchanged.

Replies run after the HTTP response, with at most two calculations per server process. Database leases and version-checked updates prevent duplicate moves across server instances. Bot-only play alternates the two saved skill presets in short batches (at most eight plies or approximately eight seconds). Keep an Arena lobby/list or spectator board open for automatic pairing and play; visible-page polling and Realtime refreshes resume the next batch. There is no unattended background scheduler. Board/lobby refreshes recover interrupted work. No external engine service or new credentials are needed.

## Rollout

Apply `supabase/migrations/20260907012638_internal_arena_bots.sql`, then `supabase/migrations/20260907173735_internal_arena_bot_pairs.sql`, before deploying the application. These add private bot data, both bot participant snapshots, matching/lease RPCs, in-progress withdrawal and bot-aware Arena finalization. Existing human games keep their original representation. New tables/RPCs have browser-role privileges revoked and service-role access explicitly granted.

`next.config.ts` includes the existing Stockfish JavaScript and WASM files in the server deployment bundle. Do not omit either file when deploying.

Release order: verify the database migration first, then push the application to `main` for the existing Vercel production deployment.

For the difficulty slider, apply `supabase/migrations/20260907180710_arena_bot_difficulty_slider.sql` before deploying its UI. It expands validation without rewriting existing bot/game data and retains service-role-only access.

## Verification

- Full Vitest suite, lint/TypeScript checks and production build.
- Real Stockfish tests for all six levels, legal moves and promotion.
- Server tests for either bot color, human move acknowledgment, duplicate work, recovery, resignation, timeout and completion without PvP ratings.
- `scripts/verify-arena-bots.mjs` executes the migration in a disposable PGlite database. It checks caps, eligibility, human/bot matching, idempotent scoring, leases, skill snapshots, removal/end rules and RLS/grants. Pass the installed `@electric-sql/pglite` module path as its argument; it never uses production credentials.
- Browser checks use real UI components with fixture data, including add/edit/remove, force pairing, student isolation and phone/tablet/desktop sizing. Production account mutations and a deployed engine round-trip remain rollout checks.
