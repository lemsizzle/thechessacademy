# Internal Chess Roadmap

Last verified: 2026-08-21

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
