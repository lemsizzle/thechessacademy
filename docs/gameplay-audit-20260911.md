# Board and gameplay audit — 2026-09-11

Checked local application components in Chromium and WebKit at 390, 820, and
1440 CSS pixels, with touch enabled. The earlier responsive-board matrix also
covered 320, 768, 1024, and 1366 pixels, both orientations, and all piece themes.

## Fixes

- Shared square board frames keep pieces and arrows aligned independently of
  parent height in Puzzle Training, Star Wars, and AcademyChessboard consumers.
- Hide and Seek's covered and active grids now derive height from their width.
  WebKit previously made the active inner grid 348 × 358 pixels on a 390-pixel
  viewport. After the fix, the grid and annotation SVG both measure 348 × 348;
  all 64 cells are square. The same checks pass at tablet and desktop widths.
- Promotion and game dialogs move focus inside, contain Tab/Shift+Tab, support
  Escape cancellation when available, and restore prior focus. Analysis keyboard
  shortcuts stop while a modal is open. Dialogs scroll on short screens.
- Correspondence waiting messages no longer offer unsupported premoves or refer
  to pausing a live clock.

## Coverage

| Area | Browser checks |
| --- | --- |
| Shared game board | Tap moves, deselect, keyboard moves, locked input, drag across an opponent reply |
| Live play | Optimistic move, exactly-once premove, delayed confirmation, stale snapshot, rejection rollback |
| Correspondence | Legal turns, blocked moves while waiting, no unsupported premove prompt, cancel resignation |
| Survival | Launch, square/arrow layout, reject illegal destination, submit legal move |
| Daily / Woodpecker | Launch each mode and submit a legal move |
| Star Wars | Complete a four-move mission and advance; retained piece selection |
| Hide and Seek | Reveal, mark safe/unsafe squares, score, square dimensions, mistake-arrow overlay |
| Adaptive review | Load a review, submit an answer, show success |
| Analysis / shared study workspace | Move tree, previous/start navigation, underpromotion, keyboard-safe promotion dialog |
| Adventure | Representative lesson move and hint; boss move and opponent response |
| Vs computer | Start, human/opponent moves, takeback, touch arrow and clear |
| Teacher / tournament spectators | Read-only board, flip orientation, no move submission |
| Stockfish | Load the actual bundled JS/WASM worker and return a legal move in both engines |

66 area/device checks, six live/shared-board scenarios, and six additional
mode/dialog/correspondence scenarios passed. The more detailed Hide and Seek
geometry/arrow checks were rerun after its fix and passed in all six combinations.
Type checking and the production build passed. The full suite passed 753 tests
with two workers; an earlier fully parallel run hit the existing five-second
adventure-hint timeout. The eight Hide and Seek UI tests passed again after its
final layout change.

## Reproduce and limits

See [browser check instructions](../tests/browser/gameplay-harness.md).
Screenshots are under `work/gameplay-audit`.

Browser fixtures use real UI components with simulated API responses and
deterministic bot replies; Stockfish is separately tested with its actual worker.
These checks do not certify production authentication, database/reward writes,
real multiplayer delivery, every adventure puzzle, or physical iPad/iPhone
behavior. Backend chess, clock, tournament, correspondence, puzzle, and adventure
logic is additionally covered by the repository's unit tests.

Verification completed before release; see Git history for the release commit.
