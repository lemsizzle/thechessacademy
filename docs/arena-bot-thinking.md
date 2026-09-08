# Tournament bot thinking

Arena bots reuse `createBotThinkingDelay`, the same position-complexity and clock-aware policy as Play vs Computer. Forced replies and sparse endgames stay quick; richer positions have varied waits, capped at 45 seconds of deliberate thinking.

The random roll is deterministic for a saved game/ply/position. The deadline is anchored to the persisted clock start, so polling, refreshes, and server restarts do not reroll or restart the wait. The active bot's saved clock and Berserk increment rules determine its budget. Engine processing time and server load may add to the visible response time.

Each existing Next.js `after` callback handles at most one move. Waiting happens outside the bounded engine queue and before claiming the database's 15-second bot lease. Once the deadline arrives, the worker claims a fresh row, checks timeout and turn identity again, then runs the existing engine and version-checked move write. Overlapping workers cannot fast-forward the following bot's turn. No schema change is needed.

The existing board/lobby polling schedules subsequent turns and recovers interrupted callbacks; bot-only games no longer play eight immediate plies in a batch. Thinking consumes the bot's game clock. Resignation/completion during the wait prevents a move. Existing tournament pause behavior still pauses new pairings, not ongoing games.

Verification: fake-clock server tests cover first and later replies, polling deduplication, resignation while waiting, stale workers, timeouts, engine failure recovery, both bot colors, and bot-only games. Shared-policy tests cover complexity, forced moves, endgames, clock limits, and reproducible deadlines.
