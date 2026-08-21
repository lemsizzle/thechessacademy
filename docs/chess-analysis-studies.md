# Chess Analysis and Studies

## Architecture

- `AnalysisWorkspace` is the shared client workspace used by completed-game analysis and persistent study chapters.
- `AnalysisTree` is a versioned, flat node map. Every node stores its parent, ordered children, selected main child, resulting FEN, SAN/UCI move, origin, comment, NAGs, and board shapes. Shapes persist semantic styles (`primary`, `secondary`, `warning`, `danger`) rather than theme-specific colors.
- Original completed-game nodes are marked `original` and cannot be deleted. Analysis moves are legal moves replayed with `chess.js` and form true side variations.
- A chapter saves its full tree as one validated JSONB document. This makes annotation and branch changes atomic. Chapter `version` is used for optimistic concurrency.
- Client changes are debounced for 800 ms. If edits arrive during a request, the editor queues another save using the returned version.
- Stockfish analysis is off by default and runs only in `/public/vendor/stockfish` through a dedicated Web Worker. Position changes hard-cancel stale searches. MultiPV is fixed at three lines.

## Routes

- Student library: `/student/studies`
- Student completed-game analysis: `/student/play/game/[gameId]/analysis`
- Student study: `/student/studies/[studyId]`
- Teacher library: `/admin/studies`
- Teacher completed-game analysis: `/admin/play/game/[gameId]/analysis`
- Teacher study: `/admin/studies/[studyId]`

## Persistence and authorization

- `internal_chess_games` is append-only for the service role (`SELECT`, `INSERT`). Browser roles have no grants.
- `chess_studies`, `chess_study_members`, `chess_study_chapters`, and `chess_review_assignments` are server-only tables with RLS enabled and deny policies for `anon` and `authenticated`.
- The app keeps its existing custom Lichess student cookie and teacher cookie. API routes verify those identities, then use the server service-role client.
- Students may only read their own completed games. Study owners and editors may save; viewers are read-only; only owners and teachers may delete. Teachers can review all internal games and studies.
- “Add to Study” can create a named Study or append the game to any existing editable Study. A Study editor can also add another completed game directly as a new chapter.
- The server runtime must provide `SUPABASE_SERVICE_ROLE_KEY`; it must never be exposed through a `NEXT_PUBLIC_` variable or browser bundle.

## Database migrations

1. `20260815090000_create_internal_chess_games.sql`
2. `20260815100000_create_chess_studies.sql`
3. `20260815101000_index_chess_study_source_games.sql`
4. `20260816020000_create_chess_review_assignments.sql`
5. `20260821090000_extend_chess_review_feedback.sql`

## Phase status

- PGN import/export with headers, comments, NAGs, nested variations, results, and starting FEN is implemented.
- FEN-based chapter creation and source metadata is implemented.
- Teacher UI and owner-protected APIs for adding editors/viewers are implemented; the authenticated teacher-browser smoke test remains outstanding.
- Optional node-level evaluation snapshots for teacher-authored reference lines are implemented; the authenticated teacher-browser Save/Remove smoke test remains outstanding.
- Teacher review assignments support whole-study or chapter scope, prompts, gated teacher answers, student written responses, teacher approve/return feedback, reset, and automatic viewer access.
- The Phase 5B application code, tests, production build, live migration, catalog constraints, privileges, and database state transitions are verified. The authenticated submit/return/resubmit/approve student-browser workflow and teacher-authenticated UI smoke test remain outstanding.

See `docs/chess-roadmap.md` for the durable phase tracker and evidence gates.
