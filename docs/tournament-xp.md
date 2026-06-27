# Arena Tournament XP

Arena scoring uses the `score` returned by Lichess. Final scoring should use finished tournaments because ongoing scores and ranks can change.

## MVP Rules

- Participation: 25 XP
- Arena score: 5 XP per Arena point
- Top 3 finish: 50 XP
- Weekly Arena cap: 300 XP

The app calculates one combined pending award per student and tournament. This applies to both team-synced and imported Arenas. It does not add XP during result sync.

## Approval Flow

1. Sync a finished Arena on `/admin/tournaments/results`.
2. Review calculated awards on `/admin/tournaments/awards`.
3. Edit the XP amount or add a teacher note if needed.
4. Approve to update the student's XP and create local XP/activity records.
5. Reject to keep the student's XP unchanged.

An award cannot be created twice for the same student and Lichess tournament. Approved and rejected awards cannot be processed again.
