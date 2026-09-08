# No consecutive tournament opponents

Tournament pairing now checks the latest pairing of **both** participants in the same Arena. It rejects a pair if either participant's last opponent was the other, regardless of color. This covers human/human, human/bot, bot/bot, automatic matchmaking and teacher-selected pairings.

Automatic matchmaking looks for a different eligible opponent. With only the previous opponent available, it returns `waiting` rather than creating a rematch. Explicit teacher selections report that a different opponent is required. Both participants must play somebody else before meeting again. Existing games are not cancelled, and other tournaments and non-tournament rematches are unaffected.

The service-only `arena_entries_can_pair` SQL helper uses durable pairing history and existing indexes. No client-provided avoid parameter or in-memory state is required. Existing tournament row locks still serialize matchmaking, preserving pause handling, queue state, and atomic game/pairing insertion. Bot-only selection searches eligible pairs rather than taking the oldest two entries blindly.

Applied to the existing Supabase project using migration `prevent_consecutive_arena_pairings`. No application redeploy is needed for the rule to take effect. The migration and verification scripts are versioned alongside the application.

Verification:

- `scripts/verify-arena-no-repeat-pairings.sql`: disposable students and bots, three pairing types, reload/retry, swapped participants, explicit teacher pairing, no orphan games, alternative selection, asymmetric history, later permitted rematches, and tournament isolation. Runs as `service_role` and rolls back every fixture.
- `scripts/verify-arena-pause-berserk.sql`: uses fresh opponents for independent scoring scenarios; pause, resume, scoring and idempotency still pass.
- Verified no temporary students/tournaments remain. The new helper is executable only by the server role; security advisors introduced no new warnings.
