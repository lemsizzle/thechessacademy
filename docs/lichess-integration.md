# Lichess Integration

The first version is mock-ready and safe to run locally. Real Lichess calls happen only after a student or teacher clicks a sync button, or after a student returns from Lichess OAuth.

## Rating Sync

The app syncs public Blitz and Rapid rating summaries from:

`GET https://lichess.org/api/user/{username}`

Stored summary fields include rating, games, rating change, rating deviation, provisional status, profile URL, sync status, and last sync dates. If Lichess cannot be reached, the app uses mock fallback ratings so the UI still works.

## Lichess XP Rules

Rating XP uses achievement milestones instead of changing point by point:

- Each full 100 rating above 800 earns 15 XP for established Blitz.
- Each full 100 rating above 800 earns 15 XP for established Rapid.
- Each full 100 rating above 800 earns 10 XP for Puzzle.
- Rating XP is capped after 12 milestones in each category.
- The highest established rating recorded is retained, so rating losses never remove XP.
- Provisional Blitz and Rapid ratings earn no rating XP.

Activity XP only begins after the student's preserved first-login baseline:

- Rated Blitz or Rapid game: 2 XP
- Puzzle completed: 1 XP

Past games and puzzles are not counted.

## Student Game Submissions

The app does not automatically scan Lichess games for tactics. Students submit games manually when they want review.

For tactic review, students include:
- Lichess game link
- tactic type
- move number
- optional note

Students can also submit a game for general analysis without claiming a specific tactic.

## Admin Approval

Approving a submitted tactic:
- marks the submission approved
- increments that student's tactic progress for the selected theme
- checks existing tactic badge thresholds
- creates pending badge/XP awards when thresholds are reached

It does not directly grant per-game XP. This prevents XP farming.

## Rate Limits

If Lichess returns `429`, the app falls back to mock data and logs a retry note. In production, store the retry window and disable sync buttons until the retry time has passed.

## Privacy And Security

- Lichess tokens stay server-side only.
- Public student pages show compact rating summaries and student-owned submissions.
- Admin pages show student-submitted game review requests.
- Get parent/student consent before connecting Lichess accounts.
- Store only the summaries you need unless there is explicit consent to keep raw game/activity data.

## Future Upgrade

A future Stockfish-backed analysis helper could support teacher review. Keep it behind admin review and avoid automatic awards unless the teacher approves the result.
# Login With Lichess

Student login now uses a separate OAuth path from the older teacher/student profile Lichess connection tools:

- `/api/auth/lichess/start`
- `/api/auth/lichess/callback`
- `/api/auth/session`
- `/api/auth/logout`
- `/api/lichess/sync/me`

The student OAuth flow uses PKCE, verifies state, and stores the app session in an httpOnly cookie. Access tokens are encrypted before being stored in an httpOnly cookie for this mock-ready local version. In production, move encrypted tokens to Supabase or another server-side database table.

OAuth scopes requested by default:

- `puzzle:read`
- `team:read`

Lichess does not expose separate OAuth scopes for reading public game exports or public rating summaries. The app fetches Blitz/Rapid/Puzzle ratings from Lichess account/user endpoints and game activity from the Lichess game export by username. `team:read` is included for team/tournament-related read access when Lichess requires it.

Override scopes locally with `LICHESS_OAUTH_SCOPES` only when you know Lichess accepts the requested scopes. If `LICHESS_CLIENT_ID` is not configured, the app uses an explicit mock Lichess login for local development.
