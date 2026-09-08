import { createBotThinkingDelay } from "@/chess/bots/thinkingDelay";
import type { LiveGameRecord } from "@/chess/live/types";

/** A reproducible random roll: polling and other server instances must agree on this turn. */
function turnRandom(game: LiveGameRecord) {
  const key = `${game.id}:${game.moves.length}:${game.current_fen}`;
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  return (hash >>> 0) / 0x100000000;
}

export function arenaBotThinkingRemainingMs(game: LiveGameRecord, nowMs: number) {
  const startedAt = Date.parse(game.clock_started_at ?? game.started_at ?? game.created_at);
  if (!Number.isFinite(startedAt)) throw new Error("The Arena bot turn has an invalid start time.");
  const remainingMs = game.active_color === "white" ? game.white_ms : game.black_ms;
  const berserk = game.active_color === "white" ? game.white_berserk : game.black_berserk;
  const delay = createBotThinkingDelay({
    fen: game.current_fen,
    remainingMs,
    incrementMs: berserk ? 0 : game.time_control.incrementMs,
    random: () => turnRandom(game)
  });
  // Use the saved clock anchor, not the time of this request. No fresh delay on retries.
  // Wake at flag fall even if the normal minimum thinking delay would run past it.
  const deadline = startedAt + Math.min(delay, remainingMs ?? delay);
  return Math.max(0, deadline - nowMs);
}
