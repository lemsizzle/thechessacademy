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

The import is a local maintenance command. It never runs in the browser, during `next build`, or on Vercel.

1. Download the official [Lichess puzzle archive](https://database.lichess.org/lichess_db_puzzle.csv.zst).
2. Save it as `data/lichess/lichess_db_puzzle.csv.zst` in this repository. The archive and folder are gitignored.
3. Run `supabase/migrations/20260718140000_puzzle_import_compatibility.sql` in the Supabase SQL Editor, or push pending migrations from a linked CLI with `npx supabase db push`.
4. Add the real server-side values below to `.env.local`. Do not use the Vercel-masked `[SENSITIVE]` values.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
```

5. Preview the first import without changing Supabase:

```powershell
npm run import:lichess-puzzles -- "C:\Users\momin\Documents\Chess Academy web app\data\lichess\lichess_db_puzzle.csv.zst" --fast --dry-run
```

6. Run the real import:

```powershell
npm run import:lichess-puzzles -- "C:\Users\momin\Documents\Chess Academy web app\data\lichess\lichess_db_puzzle.csv.zst" --fast
```

`--fast` is the default and stops once every theme quota is full. `--sample` scans the complete archive and uses bounded reservoir sampling for a less order-biased selection:

```powershell
npm run import:lichess-puzzles -- "C:\Users\momin\Documents\Chess Academy web app\data\lichess\lichess_db_puzzle.csv.zst" --sample
```

Node.js 22 decompresses the Zstandard archive directly, so no separate `zstd` application is required. The importer streams decompression and CSV parsing, filters as it reads, validates retained solutions with `chess.js`, and upserts batches by `lichess_puzzle_id`. Rerunning the same command updates matching IDs instead of creating duplicates.

The import workflow uses existing lockfile-pinned project packages: `@supabase/supabase-js`, `chess.js`, `csv-parse`, `dotenv`, and `tsx`. No archive is sent to GitHub, Vercel, Supabase Storage, or the public app.

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
| `PUZZLE_IMPORT_PROGRESS_EVERY` | `50000` | Scanned rows between console updates |

Changing the values and rerunning the importer is safe because rows are upserted by `lichess_puzzle_id`.

For a one-command temporary quota change in PowerShell:

```powershell
$env:PUZZLE_IMPORT_PER_THEME="1000"
npm run import:lichess-puzzles -- "C:\Users\momin\Documents\Chess Academy web app\data\lichess\lichess_db_puzzle.csv.zst" --fast
Remove-Item Env:PUZZLE_IMPORT_PER_THEME
```

## Verify imported counts

Run these queries in the Supabase SQL Editor:

```sql
select count(*) as total_active_puzzles
from public.chess_puzzles
where is_active = true;

select 'fork' as theme, count(*) from public.chess_puzzles where is_active and themes @> array['fork']::text[]
union all
select 'pin', count(*) from public.chess_puzzles where is_active and themes @> array['pin']::text[]
union all
select 'skewer', count(*) from public.chess_puzzles where is_active and themes @> array['skewer']::text[]
union all
select 'mateIn1', count(*) from public.chess_puzzles where is_active and themes @> array['mateIn1']::text[];
```

The first archive dry run scanned 147,607 rows and selected 9,850 unique puzzles: 2,500 per theme, with 150 puzzles shared by more than one target theme.

## Security

The app uses its own Lichess student session rather than Supabase Auth. For that reason, both puzzle tables deny direct `anon` and `authenticated` access. The API routes verify the student's signed app cookie, confirm that the active Supabase student row still matches the Lichess identity, and then use the service role on the server.

Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `PUZZLE_SESSION_SECRET`, puzzle move sequences, or signed token secrets to browser code.

## Verification

```powershell
npm run test
npm run lint
npm run build
```

The tests cover setup-move semantics, board orientation, correct and incorrect moves, opponent replies, multi-move completion, theme filters, promotions, alternate mate-in-one answers, SVG piece coverage, token tampering, fast quota selection, overlap handling, bounded duplicate tracking, and reservoir sampling.

Puzzle source: [Lichess open puzzle database](https://database.lichess.org/#puzzles). Preserve its source/license attribution when presenting or redistributing the data.
