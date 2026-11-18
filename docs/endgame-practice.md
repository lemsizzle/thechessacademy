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
cross-device board progress, ratings, seasonal quest wins or game-history records
are written. Newly generated positions can earn 3 XP and 3 coins once, only for
unassisted checkmate. Existing browser attempts without a reward ticket remain
practice-only. Retry position preserves assistance; only New position starts a
fresh reward attempt.

`POST /api/student/endgames` authenticates the active student for start, assist,
and complete. Start issues a signed, student-bound, versioned seed ticket (valid
for seven days); generation and every chess move still run locally. Completion
reconstructs the selected candidate from the server seed and legally replays the
whole game to verify player checkmate. The database records assistance before
help is revealed, locks the attempt row, and writes one XP event atomically with
the student XP total. The existing XP trigger grants exactly 3 matching coins.
Duplicate submissions/reloads never award twice. No per-move server requests.
Apply `20261118123038_endgame_training_rewards.sql` before releasing the API.

Stockfish loading has a separate 60-second startup timeout and one automatic
retry. Endgames use one analysis line and hand the loaded generation worker to
the board. Versioned engine assets are cached for repeat visits. Canceling stops
startup/search immediately, and late worker output is ignored. Search retains
its shorter timeout, independent of downloading the engine.

Verification: `npx vitest run tests/endgames/practice.test.ts`, typecheck, full
tests/build, and `node tests/browser/verify-endgame-practice.cjs` against the
isolated puzzle-battle preview server with `ENDGAME_QA=1`. Also run
`node --test tests/endgames/rewards-db.test.mjs` and the reward/slow-loading browser
check `node tests/browser/verify-endgame-rewards.cjs`. Browser checks exercise fresh generation,
real defending moves, hints, takebacks, reload, black orientation, promotion,
checkmate/stalemate, cancellation and responsive layout. Only test scenarios for
specific terminal outcomes seed local browser state; ordinary generation uses
the real worker and random generator.
