# Generated endgame practice

Student entry: Train → Endgame Practice (`/student/training/endgames`). Twelve
skill categories cover basic mates, pawn endings, rook/pawn play and converting
large material advantages. The catalog contains teaching copy, not starting FENs.

Every **New position** constructs new randomized piece placements, optionally
reflects the files/swaps colors, rejects illegal/check/terminal starts, then asks
the local Stockfish worker to check the advantage. Acceptance requires an exact
score at depth 10 or greater: positive mate beyond one move, or at least +550 cp
for the learner. This is an engine assessment, not a tablebase proof. No static
fallback positions are served. Up to 20 candidates are checked; failure offers a
retry. The previous FEN is excluded. Cancellation/unmount stops generation.

Students play any legal moves against local Stockfish. Winning requires actual
checkmate. Stalemate, repetition, 50-move and insufficient-material draws are
explained, with takeback/retry available. Promotion choices appear on the board.
Hints show a move and arrow; hints/takebacks mark the attempt as assisted.

Each student's last attempt per skill (generated FEN plus move history) is saved
under a versioned, student-specific browser key. Reload resumes the same attempt;
New position always generates another. Full history preserves repetition and
50-move state. Save failures show an honest warning and never block play. No
cross-device progress, ratings, XP, coins, seasonal quest wins or game-history
records are written. No new database/API work or gameplay polling is added.
Stockfish startup/search has a bounded wait and a retry path.

Verification: `npx vitest run tests/endgames/practice.test.ts`, typecheck, full
tests/build, and `node tests/browser/verify-endgame-practice.cjs` against the
isolated puzzle-battle preview server. Browser checks exercise fresh generation,
real defending moves, hints, takebacks, reload, black orientation, promotion,
checkmate/stalemate, cancellation and responsive layout. Only test scenarios for
specific terminal outcomes seed local browser state; ordinary generation uses
the real worker and random generator.
