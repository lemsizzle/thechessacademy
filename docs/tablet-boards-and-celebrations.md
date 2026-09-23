# Tablet boards and reward celebrations

Board columns now measure the visible viewport and their clocks/tools, then fit
the board without transforming pieces or hit targets. Tablet landscape layouts
use two columns at the large breakpoint, and student page headings become compact
while a board is present. Shared sizing covers live/correspondence, computer,
spectator, analysis, mistake review, Survival/Woodpecker/daily, Star Wars, Hide and
Seek, and adventure boards. Resize work is event-driven, not a timer loop.

The student shell shows one non-interactive celebration at a time for saved badges
and quest completions. A popup lasts three seconds, fading during the last half
second. Placement excludes every visible board; if no safe corner exists it waits
for available space. Reduced motion removes the sliding animation. Per-student
session storage remembers seen awards across navigation/reload; unavailable
storage does not block play. Existing historic awards are not replayed on first
visit.

Puzzle badge responses notify immediately. Game saves, mode progress, store
purchases and quest synchronization request a lightweight reward refresh with one
five-second follow-up for asynchronous awards. Teacher/background awards are
checked every two minutes while visible and on focus. Requests are throttled and
never awaited by gameplay. The authenticated endpoint reads only the student's
recent award IDs/timestamps and the names needed for new notifications; no schema
changes or reward-writing changes are involved.

## Verification

- 981 tests passed, including notification ownership, first-visit behavior, read
  failures, and board-safe popup positioning. Type check and production build passed.
- Browser inspection used actual components with isolated mock API responses in
  `tests/browser/areas-harness.jsx?area=...&tablet=1`, with representative header
  space. No production student records were changed.
- 1024×768 landscape: Survival, computer game, spectator, analysis, Star Wars and
  Hide and Seek boards remained within the viewport. 768×1024 portrait Survival
  and 390×844 phone Hide and Seek also fit.
- Played e2–e4 on the resized analysis board and verified the piece and move tree.
- Badge and quest notifications appeared outside the board and disappeared after
  three seconds; repeating an already-seen badge did not display again.
- These are browser viewport checks, not tests on a physical iPad/Android tablet.

Launch the fixture with `GAMEPLAY_FIXTURE=tests/browser/areas-harness.jsx`,
`GAMEPLAY_MOCK_ENGINE=1`, and an unused `GAMEPLAY_PORT` through
`scripts/serve-gameplay-harness.mjs`. The visible Test badge/Test quest controls
exercise the real notification component without granting rewards.
