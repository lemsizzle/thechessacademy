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

## Phase 4 — Study interoperability and sharing: implementation complete; teacher-session verification pending

### 4A. PGN and FEN interoperability: complete

- Import PGN as an editable move tree.
- Preserve headers, starting FEN, main line, nested variations, comments, standard NAGs, and result.
- Export any study chapter as authenticated downloadable PGN.
- Create an empty chapter from a legal FEN.
- No new tables are required; imported trees use the existing versioned chapter document.

Evidence: `chess/analysis/pgn.ts`, `tests/chess/pgn.test.ts`, authenticated browser import/export, FEN creation, and reload verification on 2026-08-16.

### 4B. Teacher-managed sharing: implemented; teacher-session smoke test pending

- Teacher UI can add active students as editors or viewers.
- Teacher can change roles or remove access.
- Existing `chess_study_members` ownership/editor/viewer model is reused.
- Server routes enforce owner-level permission and never trust client ownership IDs.

Remaining evidence gate: perform one authenticated teacher-browser add/change/remove cycle. The production build and TypeScript checks cover the route/component boundaries, but a teacher session was not available during the 2026-08-16 browser run.

### 4C. Optional reference evaluations: implemented; teacher-session smoke test pending

- A teacher can explicitly save one selected Stockfish evaluation and principal variation on a position.
- Saved references persist inside the existing versioned analysis tree and remain visible to students even when their local engine is off.
- Teacher-only Save/Remove controls are not rendered on student study routes.
- Ordinary live Stockfish depth updates remain session-only.

Evidence: analysis-tree validation tests, student read-only rendering, TypeScript checks, and the production build. Remaining evidence gate: perform one authenticated teacher-browser Save/Remove cycle together with the 4B sharing smoke test.

## Phase 5 — Teacher review workflows: current

### 5A. Review assignments: implemented; teacher-session smoke test pending

- A teacher can assign an entire Study or a specific chapter to an active student.
- Every assignment has a plain-text review prompt and an optional teacher answer.
- Teacher answers can appear immediately, after the student's first submission, or remain teacher-only.
- Students see assigned reviews in their Studies library and can open the targeted chapter directly.
- Creating an assignment grants viewer access without downgrading an existing editor/owner role.
- Submission timestamps and answer-release rules are enforced by authenticated server routes; hidden answers are omitted from student responses.
- The assignment table is server-only, RLS-enabled, indexed by assignee/status and study, and protected by duplicate/workflow consistency constraints.

Evidence: `20260816020000_create_chess_review_assignments.sql`, review-assignment unit tests, live database catalog/constraint checks, and a student-browser assign/open/complete/reopen/answer-gating workflow on 2026-08-16. Remaining evidence gate: perform the teacher-browser create/reset/remove flow when an authenticated teacher session is available.

### 5B. Student response and teacher feedback: implemented and database-verified; authenticated browser smoke test pending

- A student can submit a required written answer of up to 4,000 characters and revise it after a teacher return.
- The review lifecycle is `assigned → submitted → approved` or `assigned → submitted → returned → submitted`; teachers can also reset reviewed work to `assigned`.
- A teacher can approve with optional feedback or return with required feedback. Server authorization prevents students from changing review decisions and prevents teachers from approving or returning work that is not submitted.
- The existing completion timestamp is retained as the submission timestamp. A separate review timestamp records approve/return decisions, and legacy `completed` rows migrate to `approved`.
- Student and teacher interfaces expose the response, feedback, status, and available actions without realtime editing.

Evidence on 2026-08-21: 95 automated tests, TypeScript, and the production build pass. `20260816020000_create_chess_review_assignments.sql` and `20260821090000_extend_chess_review_feedback.sql` are recorded in the live migration history. Catalog checks confirm the response/feedback columns, four-state workflow constraints, RLS, denied browser-role access, and service-role CRUD access. An exact temporary fixture completed `assigned → submitted → returned → submitted → approved`; its study, membership, and assignment rows were then removed and verified absent. Supabase advisors reported no review-assignment findings.

Remaining evidence gates: exercise submit/return/resubmit/approve through the authenticated student UI/API and perform the teacher-browser create/review/reset/remove smoke tests from 5A/5B. The 2026-08-21 in-app-browser attempt was blocked by its localhost URL policy after an initial connection-refused screen; no alternate browser bypass was used.

## Next phase after Phase 5

Interactive teaching from Studies: select a position, define one or more expected moves, and reuse the analysis board for a guided guess-the-move exercise before general puzzle conversion.
