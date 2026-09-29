# Student menu regression checks

Run the isolated component fixture from the repository root in PowerShell:

```powershell
$env:GAMEPLAY_PORT='9451'
$env:GAMEPLAY_FIXTURE='tests/browser/navigation-harness.jsx'
$env:GAMEPLAY_MOCK_ENGINE='1'
$env:GAMEPLAY_NAVIGATION='1'
node scripts/serve-gameplay-harness.mjs
```

Open `http://127.0.0.1:9451/student/training`. This uses the real sidebar,
mobile navigation, mode selectors, Survival trainer and computer game components.
Other destinations display their path and a disposable detail view to verify
navigation and same-page reset. API responses, bot engine and Next navigation
are mocked; no production requests or student writes occur.

Verified on September 29, 2026:

- Play can be selected while the puzzle selector is open.
- Start a bot game, play e4, receive Nc6, click Play, then close its selector:
  the position and move history remain intact.
- Train works from a bot game and reopens mode choices during Survival, including
  immediately after starting a puzzle load. Cancelled work does not restore the
  old board over the selector.
- Close the Quests selector and click Quests again: it reopens.
- Avatar Store, Home, Correspondence, Tournaments, Badges, Game Achievements,
  Studies, Submit Work, Stats, Leaderboard and Resources FAQ reach their paths.
- Open a disposable detail view, click its current menu destination again:
  the detail view resets. The navigation shell stays mounted.
- Collapsed sidebar links remain usable beside a mode selector.
- At 390×844, primary navigation and More links work above the mode selectors,
  and Train returns from Survival to the selector.
- At 1024×768, the gameplay sidebar remains as an 80px icon rail; the full bot
  board fits (about 583px square, bottom at 666px). Play and Train remain usable.
- No browser console errors were observed.

Production navigation keeps Next Link behavior for other pages, query changes,
hashes and modified clicks. Same-page menu activation stays client-side and does
not add server requests. Play and Quests register a reopen action; Train uses its
existing exit-to-setup cleanup; other current destinations remount page content.
