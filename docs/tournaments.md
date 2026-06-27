# Lichess Arena Tournaments

The Quest Board supports Lichess Arena tournaments only. Swiss tournaments are not supported.

## Team Setup

For the team URL `https://lichess.org/team/outschool-battleground`, the team ID is the final URL segment:

`LICHESS_TEAM_ID=outschool-battleground`

Optional settings:

- `LICHESS_TOURNAMENT_CREATED_BY`
- `LICHESS_TOURNAMENT_SYNC_INTERVAL_MINUTES`

## Arena Sync

The server fetches team Arenas from:

`GET https://lichess.org/api/team/{teamId}/arena`

NDJSON is parsed line by line. Invalid lines are ignored. The normalized result is cached in memory for the configured interval, and mock Arena data is returned if the team is missing or Lichess is unavailable.

Admins sync from `/admin/tournaments`. Public and student pages call the local API rather than Lichess directly.

## Importing External Arenas

An admin can also import an Arena that was not hosted by the configured team. In `/admin/tournaments`, paste either:

- `https://lichess.org/tournament/abc123`
- `https://lichess.org/tournament/abc123/results`
- `https://lichess.org/tournament/abc123/standings`
- `lichess.org/tournament/abc123`
- `abc123`

The app extracts and validates the ID, then calls the fixed server-side endpoint:

`GET https://lichess.org/api/tournament/{id}`

It never fetches the pasted URL directly. Non-Lichess URLs and Lichess game, team, study, or Swiss URLs are rejected.

Imported tournaments use source `imported_url`. Team events use `team_sync`, and emergency manual entries use `manual_fallback`. Importing an ID that already exists shows the existing tournament instead of creating a duplicate.

Imported events are admin-only by default. The teacher can mark an imported Arena public so it appears on `/app/tournaments`.

## Results Sync

Finished Arena results are fetched from:

`GET https://lichess.org/api/tournament/{id}/results`

Admins use `/admin/tournaments/results` to sync final standings. Usernames are matched case-insensitively against linked student Lichess accounts. Matched results create pending XP awards; unmatched usernames remain visible for review.

Duplicate results and awards are prevented by tournament and username/student identifiers.

## Student Views

- `/app/tournaments` shows upcoming Arena tournaments only.
- `/student/tournaments` shows upcoming team events, public imported events, imported events relevant to that student, recent Arena results, and XP review status.
- Student profiles show a compact Arena summary.

Arena points shown beside Blitz, Rapid, and Puzzle stats include only tournaments whose actual start time is on or after the student's preserved first-login baseline. Old tournaments synced later do not increase this total.

## Manual Fallback

The admin page can add a manual Arena listing when the Lichess API is unavailable. Manual entries are clearly labeled and do not create automated result records.
