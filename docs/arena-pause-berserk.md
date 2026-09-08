# Arena pairing pause and Berserk

- The teacher lobby can pause/resume all new pairings. Existing games and the tournament timer continue. Queued students remain queued; resume schedules matchmaking for humans and bots.
- A database trigger locks the tournament row before creating an Arena game. It covers automatic, forced, human/bot, and bot/bot pairings and prevents racing requests from bypassing a pause.
- Game-complete dialogs return to the specific tournament lobby, not the tournament listing.
- A player can enable Berserk once, before their own first move. It removes half the starting clock without refunding elapsed time and disables only that player's increment. The Lichess 1+2 exception keeps 60 seconds with zero increment; zero-time/untimed games cannot Berserk.
- A Berserk win earns one extra Arena point after the winner has made at least seven moves. Short wins, draws, and losses receive no bonus. The existing transactional finalizer remains idempotent. This does not introduce Lichess streak-scoring rules or change other existing Arena scoring policies.
- Game updates use the existing participant authorization, version compare-and-swap, server clocks, and realtime snapshots. Teacher and student spectators can see Berserk status.

Rules reference: https://lichess.org/tournament/help

Database migration: `20260908012941_arena_pause_and_berserk.sql` (applied to the linked project during implementation). Browser roles receive no new write permissions.

`scripts/verify-arena-pause-berserk.sql` checks pause/resume, continuing existing games, both-color bonuses, short wins, draws, and duplicate finalization using disposable bot-only fixtures. All test writes roll back; no real student scores are changed.
