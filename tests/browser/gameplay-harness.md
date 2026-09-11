# Gameplay interaction regression checks

From the repository root, run `node scripts/serve-gameplay-harness.mjs`, then open
`http://127.0.0.1:9417`. This fixture renders the actual board and live-game
components with isolated, in-memory games. It does not contact production APIs.
The fixture includes the application's Tailwind styles and board CSS modules.
It does not test authentication or production persistence. Stop the server with
Ctrl+C when finished.

## Automated browser checks

Install Playwright and its Chromium/WebKit browsers in your test environment.
The scripts accept `PLAYWRIGHT_MODULE` for an existing Playwright installation
and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for an existing Chromium browser.

Keep the default server running on port 9417. In a second terminal, start the
additional screen fixture (PowerShell):

```powershell
$env:GAMEPLAY_FIXTURE='tests/browser/areas-harness.jsx'
$env:GAMEPLAY_PORT='9418'
$env:GAMEPLAY_MOCK_ENGINE='1'
node scripts/serve-gameplay-harness.mjs
```

Then run, from the repository root:

```powershell
node tests/browser/verify-live.cjs
node tests/browser/verify-areas.cjs
node tests/browser/verify-modes.cjs
```

These exercise the real UI components at 390, 820, and 1440 pixels in both
Chromium and WebKit. Screenshots and failure details go to `work/gameplay-audit`.

- `verify-live`: tap and keyboard moves, deselection, locked boards, dragging
  during an opponent reply, optimistic moves, premoves, stale responses, rollback.
- `verify-areas`: board/arrow proportions, overflow, analysis navigation,
  underpromotion, adaptive review, Star Wars, Hide and Seek, Survival, adventure
  lessons/boss, bot game/takeback/annotations, teacher and tournament spectators.
- `verify-modes`: modal focus, Tab wrapping, Escape/cancel, correspondence turn
  restrictions, Woodpecker, daily puzzles, and the actual Stockfish WASM worker.

The screen fixture uses deterministic simulated API responses and bot replies.
The separate `engineMove` check loads the real bundled Stockfish worker. These
checks do not certify multiplayer delivery, database writes, rewards, every
lesson, or physical iPad/iPhone behavior.

Correspondence is also available manually at `http://127.0.0.1:9417/?live&correspondence`.

## Shared board

- Click g1, click **Opponent e5**, then click f3. Selection must survive the reply
  and the output must record g1–f3 against the position after ...e5.
- Reset, click **Reply during next drag**, then drag g1 to f3. The delayed reply
  occurs during the gesture; the knight must land on f3 using the new position.
- Reset and click g1 twice. It must deselect without recording a move.
- After ...e5, focus g1 and use Enter, Up, Up, Left, Enter. This must play Nf3.
- **Lock board** must prevent further moves.

## Live game with delayed confirmation

Open `http://127.0.0.1:9417/?live`; reload between scenarios.

- Play e2–e4 and, before confirming, click g1–f3. The pawn must appear on e4
  immediately, the knight must stay on g1, and the queue must show g1–f3.
  Only one move request should exist.
- Confirm the pending move, then click **Opponent e5**. The premove must submit
  exactly once, using version 3. Confirm it, then **Deliver stale snapshot**.
  The board and history must remain at 1.e4 e5 2.Nf3, not rewind.
- In a fresh game, play e4, queue Nf3, then **Reject pending move**. The board
  must return to the starting position and the premove must be cleared.

The automated companion tests are `tests/chess/board-interaction.test.ts` and
`tests/chess/live-board-input.test.ts`.
