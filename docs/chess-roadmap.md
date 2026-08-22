# Internal Chess Roadmap

Last verified: 2026-08-22

This is the durable phase tracker for the Chess Academy's reusable internal chess system. Update it when requirements or priorities change. A phase is marked complete only after its code, automated checks, and relevant live workflow have been verified.

## Phase 1 — Internal human-vs-computer play: complete

- Shared `chess.js` rules and `react-chessboard` board.
- Local Stockfish Web Worker, clocks, promotion, takeback, results, sounds, and responsive play UI.
- Authenticated immutable completed-game persistence.
- Student Play navigation and five opponent choices.

Evidence: `docs/internal-chess-system.md`, chess game tests, production build, and desktop/mobile browser checks.

## Phase 2 — Human-like academy opponents: complete

- Pawny, Zippy Knight, Benny Bishop, Rocky Rook, and Quinn Queen.
- MultiPV candidate analysis plus configurable personality, error-band, tactical-awareness, complexity, and temperature scoring.
- Deterministic selector tests and live games against the configured opponents.

Evidence: `chess/bots`, `chess/game/config.ts`, `tests/chess/human-bots.test.ts`, and `docs/internal-chess-system.md`.

## Phase 3 — Game analysis and persistent studies: complete

- Completed-game analysis, true move trees, variations, comments, NAGs, and semantic board shapes.
- Optional local MultiPV Stockfish with stale-search cancellation.
- Persistent studies, chapters, autosave/version checks, student/admin permissions, and completed-game linking.
- Lichess-style board drawings in live games and analysis.

Evidence: `docs/chess-analysis-studies.md`, analysis/study tests, applied Supabase migrations, production build, and live persistence/reload verification.

## Phase 4 — Study interoperability and sharing: complete

### 4A. PGN and FEN interoperability: complete

- Import PGN as an editable move tree.
- Preserve headers, starting FEN, main line, nested variations, comments, standard NAGs, and result.
- Export any study chapter as authenticated downloadable PGN.
- Create an empty chapter from a legal FEN.
- No new tables are required; imported trees use the existing versioned chapter document.

Evidence: `chess/analysis/pgn.ts`, `tests/chess/pgn.test.ts`, authenticated browser import/export, FEN creation, and reload verification on 2026-08-16.

### 4B. Teacher-managed sharing: complete

- Teacher UI can add active students as editors or viewers.
- Teacher can change roles or remove access.
- Existing `chess_study_members` ownership/editor/viewer model is reused.
- Server routes enforce owner-level permission and never trust client ownership IDs.

Evidence on 2026-08-21: an authenticated teacher-browser fixture completed add, viewer/editor role changes, remove, and re-add while the authenticated student retained the expected viewer access.

### 4C. Optional reference evaluations: complete

- A teacher can explicitly save one selected Stockfish evaluation and principal variation on a position.
- Saved references persist inside the existing versioned analysis tree and remain visible to students even when their local engine is off.
- Teacher-only Save/Remove controls are not rendered on student study routes.
- Ordinary live Stockfish depth updates remain session-only.

Evidence: analysis-tree validation tests, student read-only rendering, TypeScript checks, the production build, and an authenticated teacher-browser Stockfish Save/Remove cycle on 2026-08-21.

## Phase 5 — Teacher review workflows: complete

### 5A. Review assignments: complete

- A teacher can assign an entire Study or a specific chapter to an active student.
- Every assignment has a plain-text review prompt and an optional teacher answer.
- Teacher answers can appear immediately, after the student's first submission, or remain teacher-only.
- Students see assigned reviews in their Studies library and can open the targeted chapter directly.
- Creating an assignment grants viewer access without downgrading an existing editor/owner role.
- Submission timestamps and answer-release rules are enforced by authenticated server routes; hidden answers are omitted from student responses.
- The assignment table is server-only, RLS-enabled, indexed by assignee/status and study, and protected by duplicate/workflow consistency constraints.

Evidence: `20260816020000_create_chess_review_assignments.sql`, review-assignment unit tests, live database catalog/constraint checks, student answer-gating verification, and an authenticated teacher-browser create/reset/remove cycle on 2026-08-21.

### 5B. Student response and teacher feedback: complete

- A student can submit a required written answer of up to 4,000 characters and revise it after a teacher return.
- The review lifecycle is `assigned → submitted → approved` or `assigned → submitted → returned → submitted`; teachers can also reset reviewed work to `assigned`.
- A teacher can approve with optional feedback or return with required feedback. Server authorization prevents students from changing review decisions and prevents teachers from approving or returning work that is not submitted.
- The existing completion timestamp is retained as the submission timestamp. A separate review timestamp records approve/return decisions, and legacy `completed` rows migrate to `approved`.
- Student and teacher interfaces expose the response, feedback, status, and available actions without realtime editing.

Evidence on 2026-08-21: 95 automated tests, TypeScript, and the production build pass. `20260816020000_create_chess_review_assignments.sql` and `20260821090000_extend_chess_review_feedback.sql` are recorded in the live migration history. Catalog checks confirm the response/feedback columns, four-state workflow constraints, RLS, denied browser-role access, and service-role CRUD access. An authenticated `hi` student-browser fixture completed submit, gated-answer reveal, returned feedback, revision, resubmit, and approved rendering without console errors. That run exposed and fixed the stale “to answer” counter by synchronizing card updates with the library state. The exact temporary study, membership, and assignment rows were removed and verified absent. Supabase advisors reported no review-assignment findings.

Authenticated teacher verification on 2026-08-21 additionally covered assignment creation, student submission, gated-answer reveal, teacher feedback approval, reset to assigned, and removal.

## Phase 6 — Guided move exercises: complete

- A teacher can select any Study position, write a prompt and optional success explanation, and choose up to eight accepted moves from the complete legal-move list. Move choices display both SAN and UCI.
- Exercises live on the position inside the existing versioned `AnalysisTree` JSONB document, so they inherit chapter autosave, optimistic concurrency, sharing, and authorization without another table or migration.
- Server-side tree validation rejects empty prompts, duplicate or malformed moves, and moves that are not legal from the selected position FEN.
- On student Study routes, an exercise turns the shared board into guess-the-move mode. Incorrect legal moves leave the position in place for another try; a correct move animates on the board and reveals the teacher explanation.
- Engine lines and saved teacher references stay locked until the student solves the active exercise. Moving to another position or resetting clears the session-only attempt state and never changes the saved move tree.
- Exercise diamonds in the move tree make authored positions easy to find.

Evidence on 2026-08-21: 103 automated tests, TypeScript, and the production build pass. Authenticated student and teacher fixtures verified the locked answer state, incorrect retry, correct solve, server persistence, teacher reporting, exercise create/edit/remove, engine/reference unlock, and move-tree marker. The exact temporary fixture was removed afterward.

## Phase 7 — Guided progress and Puzzle Training conversion: complete

- Every legal student exercise attempt is re-evaluated on the server and persisted with the Study, chapter, position, student, SAN/UCI move, prompt snapshot, correctness, and timestamp.
- Teacher reporting aggregates solved, first-try, retry, and attempt totals without exposing the server-only attempt table to browser database roles.
- Teachers can publish, update, and unpublish a guided position in the reusable Puzzle Training catalog. Every accepted exercise move remains valid.
- Direct Study puzzles start from the authored position instead of replaying a Lichess setup move and use the existing signed session-token validation and training-attempt storage.
- New tables and source metadata are RLS-enabled, browser-denied, service-role-only, indexed, and live in the Supabase migration history.

Evidence on 2026-08-21: 103 automated tests, TypeScript, lint, and the production build pass. Both migrations are applied. Supabase advisors report no unindexed foreign keys introduced by this phase. An authenticated student played an incorrect then correct guided move, the teacher report showed `Solved` with `2 (1 incorrect)`, the teacher publish/update/unpublish controls persisted both accepted moves, and the student solved the teacher-authored position in Puzzle Training on the first try. Authenticated teacher smoke tests also closed the outstanding sharing, reference-evaluation, review, and exercise-authoring evidence gates. All deterministic smoke-test rows were removed and verified absent.

## Phase 8 — Student-vs-student live games: complete

- Authenticated students can create a private 12-character challenge, choose a supported time control and color, share the code, or join another student's waiting challenge.
- Every move, clock transition, draw action, resignation, cancellation, and timeout claim is revalidated by authenticated Next.js routes against the canonical server-only game row. Optimistic versions prevent two serverless requests from advancing the same position.
- Supabase Broadcast sends only a minimal invalidation event on a high-entropy capability topic. Participants then refetch the complete snapshot through the authenticated API; browser roles have no direct table privileges and a polling fallback covers disconnects.
- Reloading or reconnecting restores the position, move history, draw offer, and timestamp-based clocks. The server, rather than the browser, decides flag fall and game results.
- Completed games generate normalized PGN and create one existing `internal_chess_games` history row for each player, so both students can reuse the established analysis and Study workflows.
- The responsive game page reuses the academy board, promotion chooser, clocks, move history, and Lichess-style local drawing tools.

Evidence on 2026-08-21: 109 automated tests across 22 files, TypeScript, and the production build pass. The migration is recorded in the live Supabase history. RLS and explicit privilege checks deny `anon` and `authenticated` table access while `service_role` retains server CRUD. Supabase advisors report no Phase 8 security findings or unindexed foreign keys. An authenticated browser created a challenge; a controlled second student joined; Broadcast updated both join and move state; both students played; a draw offer was accepted; two completed-game history rows and PGN were verified; a page reload restored the result; the mobile lobby had no horizontal overflow; and all exact smoke-test rows were removed and verified absent.

## Phase 9 — Student game history and performance: complete

- Completed computer and live games appear in one newest-first student record.
- Lifetime W–D–L, win rate, and computer/live totals are calculated server-side.
- Opponent and result filters use stable, bounded database pagination.
- Every record opens the existing authorized analysis board without exposing
  full PGN or database credentials in the history response.
- The history page is available from both the student navigation and Play hub.

Evidence on 2026-08-22: 125 automated tests across 24 files, TypeScript, and the
production build pass. An authenticated student browser loaded three completed
computer wins matching the live database aggregate, filtered to an empty loss
record, returned to wins, and opened a listed game on the authorized analysis
board. Both Play-hub and sidebar links rendered, the desktop layout was visually
checked, responsive classes were reviewed for phone layouts, and a clean page
load produced no browser-console errors.

## Phase 10 — Teacher chess performance: complete

- Teachers can review internal computer and live-game activity across the full
  active roster or one class.
- Summary totals deduplicate the two personal history rows generated by a live
  student-vs-student game.
- Every student row shows W–D–L, win rate, mode split, recent activity, and
  coaching links to the student editor and latest game analysis.
- Students without completed games remain visible so participation gaps are
  clear instead of silently disappearing.
- Server Components read only lightweight fields through the service client;
  no service credentials or roster-wide records are exposed through a public
  browser API.

Evidence on 2026-08-22: 131 automated tests across 26 files, TypeScript, and the
production build pass. The live database baseline contained 35 active students,
one active internal-chess player, and three unique completed computer games in
the last 30 days. An authenticated teacher browser reproduced those totals,
filtered the roster to five Saturday Knights students, showed the active
student's 3–0–0 record, and opened the latest saved game on the authorized
analysis board with working move controls. The verified flow produced no
browser-console errors.

## Phase 11 — Academy PvP ratings, matchmaking, and rematches: complete

- Timed games update both players exactly once through a locked, idempotent Elo
  transaction; the first ten games use a provisional K-factor. The resulting
  values remain teacher-only and are not shown or returned to students.
- Quick matchmaking pairs waiting students by clock and privately uses the
  nearest current rating. Queue tickets expire after ten minutes, support cancellation,
  and create the live game transactionally so two requests cannot claim the
  same opponent.
- Completed opponents can request a rematch. Mutual requests create one new
  live game with reversed colors, the same clock, and the same internal scoring policy.
- Students see neutral game, result, history, and analysis screens without
  rating controls, values, deltas, rankings, or a rating dashboard.
- Teachers have a server-rendered rating roster and can make documented,
  range-checked adjustments. Each adjustment is retained in the same immutable
  ledger as game changes.
- Rating profiles, events, and queue tickets are RLS-enabled, denied to browser
  roles, and callable only through authenticated Next.js routes and
  service-role-only database functions.

Evidence on 2026-08-22: 147 automated tests across 30 files and TypeScript pass.
Both Phase 11 migrations are in the live Supabase history. A rollback-only live
database verification exercised waiting and matched queue states, transactional
game creation, rated completion, two rating events, idempotent retry, mutual
rematch with reversed colors, and teacher adjustment. Supabase security advisors
reported no Phase 11 finding, and the two rematch foreign-key index findings were
resolved by the follow-up migration.

## Phase 12 — Learn from your mistakes: complete

- A student can request an on-device Stockfish review from any completed-game
  analysis page. The engine remains off until requested and evaluates only the
  immutable original game line.
- Evaluation losses are classified by familiar thresholds; mistakes and
  blunders are converted into private retry positions from the student's board
  orientation, while inaccuracies are intentionally excluded for now.
- The board locks unrelated engine lines during practice while retaining local
  drawing tools, accepts legal retry moves, provides beginner-friendly feedback,
  and can reveal the best move and principal variation.
- MultiPV alternatives within 0.35 pawns of the best engine move are accepted,
  avoiding false failures when several moves are practically equivalent.
- Scans are cancellable, stale results cannot replace a newer request, workers
  terminate after completion or navigation, and no engine depth stream is
  written to the database. Phase 13 persists only the finished review positions.

Evidence on 2026-08-22: mistake classification, color normalization, forced-mate
normalization, original-line filtering, equivalent-move acceptance, ordered
MultiPV output, hard cancellation, terminal positions, TypeScript, the complete
automated suite, and the production build pass. The original game remains the
review source even after temporary analysis variations are created or promoted.

## Phase 13 — Adaptive mistake training: implemented; deployment verification pending

- Completed-game analysis now saves each mistake or blunder as one private,
  student-owned review position without changing the immutable original game.
- A server-verified spaced-repetition schedule returns missed positions after a
  short delay and widens successful reviews through 1, 3, 7, and 14 days before
  marking the idea mastered. Revealed answers return the next day.
- Puzzle Training includes a personal cross-device queue with due, learning,
  review, mastery, and accuracy summaries, the original red move arrow, instant
  legal moves, beginner explanations, and a link back to the source game.
- Every attempt is retained in an immutable ledger. Completed mistake reviews
  are included in existing Academy Puzzle quest activity, so teachers can use
  the current quest rewards, XP, coins, and badge workflow without a parallel
  reward system.
- Teachers have a roster-wide Adaptive Training report showing positions, due
  work, learning/mastered totals, accuracy, attempt counts, and last review.
- Both tables and the atomic scheduling function are server-only, RLS-enabled,
  explicitly denied to browser roles, foreign-key indexed, and authorized by
  the existing verified Lichess session routes.

Evidence on 2026-08-22: 161 automated tests across 33 files, TypeScript, and the
production build pass. Migration `add_adaptive_mistake_training` is recorded in
the live Supabase history. A rollback-only database exercise verified the
scheduler transition and attempt ledger; catalog checks verified RLS and exact
browser/service privileges. Supabase advisors reported no Phase 13 security or
missing-index findings. The local unauthenticated browser path redirects safely
without an error overlay or console errors. Final authenticated production UI
verification remains pending until these application changes are pushed and
deployed.
