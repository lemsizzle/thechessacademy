# Puzzle Training

The student puzzle trainer at `/student/training` uses curated positions from the official Lichess open puzzle database. It supports Mixed, Fork, Pin, Skewer, and Mate in 1 sessions.

## How it works

- `react-chessboard` renders consistent SVG chess pieces and supports drag-and-drop and click-to-move.
- `chess.js` loads FEN positions, checks legal moves, and replays the official solution.
- Lichess stores the position **before** the opponent's setup move. The app applies `moves[0]`, then waits for the student's first answer at `moves[1]`.
- Puzzle answers never enter browser code. The server sends a signed state token and validates each submitted move.
- A session contains up to 10 puzzles. Three incorrect moves end survival mode.
- Completed and unfinished attempts are written to `student_puzzle_attempts` by server routes using the Supabase service role.

## Database setup

Run the migration in Supabase before enabling the feature:

`supabase/migrations/20260718121302_puzzle_training_tables.sql`

Add a private Vercel environment variable:

`PUZZLE_SESSION_SECRET=replace_with_a_long_random_secret`

The existing `ADMIN_SESSION_SECRET` is accepted as a fallback, but a separate puzzle secret is recommended. Never prefix this variable with `NEXT_PUBLIC_`.

## Import official puzzles

1. Download `lichess_db_puzzle.csv.zst` from [database.lichess.org](https://database.lichess.org/#puzzles).
2. Install the `zstd` command-line tool. On Windows, `winget install Facebook.Zstandard` is one option.
3. Put the download in `.local/lichess/`. This folder and `*.csv.zst` are gitignored.
4. Confirm `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. Run:

```powershell
npm run import:lichess-puzzles -- .local/lichess/lichess_db_puzzle.csv.zst
```

The importer streams decompression and CSV parsing, validates each retained solution with `chess.js`, upserts by Lichess puzzle ID, and stops after its theme quotas are filled. It does not load the full database into memory.

If `zstd` is installed somewhere unusual, set `ZSTD_PATH` to the executable path for the import command.

## Import settings

These optional server-side values tune the curated pool:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `PUZZLE_IMPORT_RATING_MIN` | `600` | Lowest puzzle rating |
| `PUZZLE_IMPORT_RATING_MAX` | `2200` | Highest puzzle rating |
| `PUZZLE_IMPORT_MIN_POPULARITY` | `70` | Minimum community popularity |
| `PUZZLE_IMPORT_MIN_PLAYS` | `50` | Minimum number of attempts |
| `PUZZLE_IMPORT_PER_THEME` | `2500` | Target rows for each supported theme |
| `PUZZLE_IMPORT_BATCH_SIZE` | `250` | Supabase upsert batch size |

Changing the values and rerunning the importer is safe because rows are upserted by `lichess_puzzle_id`.

## Security

The app uses its own Lichess student session rather than Supabase Auth. For that reason, both puzzle tables deny direct `anon` and `authenticated` access. The API routes verify the student's signed app cookie, confirm that the active Supabase student row still matches the Lichess identity, and then use the service role on the server.

Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `PUZZLE_SESSION_SECRET`, puzzle move sequences, or signed token secrets to browser code.

## Verification

```powershell
npm run test
npm run lint
npm run build
```

The tests cover setup-move semantics, board orientation, correct and incorrect moves, opponent replies, multi-move completion, theme filters, promotions, alternate mate-in-one answers, SVG piece coverage, and token tampering.

Puzzle source: [Lichess open puzzle database](https://database.lichess.org/#puzzles). Preserve its source/license attribution when presenting or redistributing the data.
