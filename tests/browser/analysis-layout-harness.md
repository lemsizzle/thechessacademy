# Board-first analysis layout

Run the actual teacher shell and analysis workspace with isolated game data:

```powershell
$env:GAMEPLAY_PORT='9453'
$env:GAMEPLAY_FIXTURE='tests/browser/analysis-layout-harness.jsx'
$env:GAMEPLAY_MOCK_ENGINE='1'
$env:GAMEPLAY_NAVIGATION='1'
node scripts/serve-gameplay-harness.mjs
```

Open `http://127.0.0.1:9453/admin/play/game/fixture/analysis`.

Verified in the in-app browser September 30, 2026:

| CSS viewport | Board width | Board top / bottom | Panels |
| --- | --- | --- | --- |
| 2016 × 1260 | 983px | 127 / 1109px | 340px side column |
| 1440 × 900 | 703px | 133 / 835px | 314px side column |
| 1024 × 768 | 571px | 127 / 697px | Below board |
| 390 × 844 | 333px | 123 / 456px | Below board |

No horizontal overflow at these sizes. All eight ranks and replay controls remain visible. Opening Advanced analysis and board drawings keeps the board width unchanged; Next move changes the position and highlights e4 in the move tree. Tools now expand below the replay buttons rather than above the board. Desktop, tablet, and phone screenshots were inspected.

Shared workspace changes apply to student and teacher game analysis and study workspaces. The fixture mocks network and engine responses; it does not test engine strength or write production data. Full suite: 1,018 tests; TypeScript and production build passed.
