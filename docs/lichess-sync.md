# Lichess Sync

The first version is mock-ready and safe to run locally.

## Current Scope

- OAuth PKCE start and callback routes exist under `/api/lichess/oauth`.
- Students connect from their own profile page with the `Connect Lichess` button.
- The Lichess access token is stored only in an HTTP-only cookie.
- Client UI never receives or displays the access token.
- Puzzle activity sync uses `/api/lichess/sync`.
- Blitz/Rapid ratings sync from the public Lichess user endpoint.
- Students can submit Lichess game links for teacher review or analysis.
- If no token is connected, sync uses mock NDJSON puzzle activity.
- NDJSON parsing is tolerant: malformed lines are skipped.
- Lichess puzzle themes are mapped to academy tactic themes.
- Eligible tactic badges become pending awards.
- Teacher approval is required before XP and badges are applied.
- Duplicate badge awards are prevented.

## Student Flow

1. Student opens their profile page.
2. Student clicks `Connect Lichess`.
3. Lichess handles the OAuth permission screen.
4. The app returns to the same student profile.
5. The app syncs Blitz/Rapid ratings and puzzle progress.
6. Students submit game links manually when they want tactic review or full game analysis.

## Future Supabase Tables

Recommended tables:
- `student_lichess_accounts`
- `game_review_submissions`
- `student_tactic_progress`
- `lichess_sync_logs`
- `pending_awards`

Tokens should be encrypted or stored through a secure auth provider/session system. Do not store Lichess tokens in browser localStorage.

## Privacy

Only sync data needed for classroom progress. Public pages should show safe summary stats only. Keep raw API responses short-lived unless parents/students explicitly consent.

See `docs/lichess-integration.md` for the full rating, review queue, and rate-limit notes.
