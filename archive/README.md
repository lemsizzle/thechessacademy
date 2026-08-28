# Archived legacy material

This directory preserves code and notes that no longer belong in the deployed
Next.js application but may still be useful for historical reference. Archived
route sources use the `.ts.txt` suffix so TypeScript and Next.js do not compile
or expose them.

The August 2026 cleanup archived only items with no in-repository callers and a
clear active replacement:

- `legacy-api/avatar-items-route.ts.txt`: replaced by the authenticated student
  avatar APIs.
- `legacy-api/lichess-game-fetch-route.ts.txt`: its fetch/parse work is already
  performed by the active analysis flow.
- `legacy-api/lichess-oauth-callback-route.ts.txt`: replaced by
  `/api/auth/lichess/callback`. The old callback did not establish the current
  student session and could fall back to a mock-success redirect.
- `outschool-sync/`: an unauthenticated mock endpoint and its design note. It
  never persisted data or called Outschool, and no app code invoked it.

Compatibility redirects such as `/api/lichess/oauth/start` remain active because
old bookmarks or external links may still use them.
