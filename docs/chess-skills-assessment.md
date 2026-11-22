# Chess Skills Test

Skills B (`skills-b-v1`) replaces new starts of the original multiple-choice
Knowledge A quiz. It contains 30 fixed positions, five each for board vision,
tactics, checkmate, calculation, defense, and endgames. Every answer is one legal
move played on the board. Correct answers earn one point; the total is rounded
to a percentage. The 30-minute deadline continues across navigation and reloads.
There is no correctness feedback during the test. Legal wrong moves are saved;
students may clear and replace their answer before submission. Promotions require
an explicit choice on the board. The score is not an Elo rating.

Each legal board answer advances immediately to the next question, including
incorrect answers. Clearing an answer does not advance. Back and All questions
allow changes; the final move opens the submission confirmation without grading
automatically. Pending answers continue through the existing autosave queue.

Teachers open Review test from `/admin/assessments`. The authenticated review
route loads completed attempts only, with the version-specific question bank.
Every Skills B position has an interactive analysis board with the student's
move and solution continuation as separate lines where they differ. Original
position, Student move, and Solution line buttons reset temporary exploration.
Analysis and optional local engine use never modify answers or grades. Original
Knowledge A questions without a diagram retain a text-only review.

The two versions retain independent keys and reviews. Existing active original
quizzes can finish normally, and completed results remain unchanged. Teacher
reports identify each form; scores from different forms should not be compared.
Change the form version before modifying positions, accepted moves, or scoring.

`lib/assessment/skillsPositions.json` is server-only data imported through
`questions.ts`; never import the bank into a client component. Active public
responses expose diagrams and prompts, not solutions, source game links, or keys.
Move legality is checked on the server, and atomic database grading locks the
attempt, enforces ownership/version/deadline, and keeps completed scores immutable.

29 positions reuse the app's Lichess puzzle dataset snapshot, released under
[CC0](https://database.lichess.org/#puzzles); each record retains its source game.
The final rook-underpromotion position is composed for Chess Quest. Setup moves
are already applied to every stored FEN. All solution continuations were replayed
with chess.js and first moves audited with bundled Stockfish 18 Lite at depth 16,
multiple principal variations (all legal moves in endgames). All immediate
checkmates are accepted, including both rook and queen promotion in position 29.
The other selected positions have a clear engine-confirmed first move matching
the prompt. Engines and external services are not used while students take tests.

Checks: `tests/assessment/skills.test.ts`,
`node --test tests/assessment/skills-db.test.mjs`, and
`tests/browser/verify-skills-assessment.cjs` against the isolated assessment QA server.
