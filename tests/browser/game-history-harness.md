# Student game history and analysis verification

Start the isolated preview from the repository root:

```powershell
$env:GAMEPLAY_PORT='9452'
$env:GAMEPLAY_FIXTURE='tests/browser/game-history-harness.jsx'
$env:GAMEPLAY_MOCK_ENGINE='1'
$env:GAMEPLAY_NAVIGATION='1'
node scripts/serve-gameplay-harness.mjs
```

Open `http://127.0.0.1:9452/student/play`.
The fixture renders actual navigation, bot game, live game, history, and analysis components.
All API requests are mocked; bot saves use fixture-only session storage to survive navigation/reload.
It does not write student records or test real authentication/network latency.

Verified September 30, 2026 using the in-app browser:

- Start Pawny, play e4, allow Nc6, resign: saving state becomes Analyze game.
- Dismiss the result with Review Board: Analyze game remains beside the board.
- Open analysis and jump to the final position: pawn e4 and knight c6 match the saved game.
- Back to Game History: bot and classmate games appear with distinct replay links.
- Reload history, filter Computer, and reopen the saved bot replay.
- Completed classmate, correspondence (`?correspondence`), and Arena (`?arena`) views at `/student/play/live/fixture-live` expose Analyze game and Game History.
- Classmate analysis remains available after closing the result panel; tournament link opens the replay.
- Mobile More contains Game History; at a measured 390px CSS viewport the history page has no horizontal overflow.
- Desktop sidebar contains Game History beneath Play.
- `/student/play/history?empty` shows an empty state and Play a game link.
- `/student/play/history?history-error` shows an error with Try again.

Separate verification covers real persistence: a read-only production query confirmed that a recent live match ID does not equal its student's saved replay ID, while the source-match plus player lookup returns exactly one record. Unit tests check both player perspectives, direct history IDs, cross-student denial, teacher behavior, and database errors. No schema changes or data writes were needed.

Checks: 1,018 tests, TypeScript checks, and production build passed. The first fully parallel test run hit an unrelated adventure timeout; the complete suite passed with two workers.
