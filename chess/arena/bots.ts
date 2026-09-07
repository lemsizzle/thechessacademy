import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import type { ChessColor } from "@/chess/types";

export const MAX_ARENA_BOTS = 12;
export type ArenaBot = { id: string; name: string; difficultyId: string; removed?: boolean };
export type ArenaGameBot = ArenaBot & { color: ChessColor };

export function arenaGameBots(game: { arena_bot?: ArenaGameBot | null; arena_opponent_bot?: ArenaGameBot | null }): ArenaGameBot[] {
  return [game.arena_bot, game.arena_opponent_bot].filter((bot): bot is ArenaGameBot => Boolean(bot));
}

export function arenaBotDifficulty(id: unknown) {
  return BOT_DIFFICULTIES.find((bot) => bot.id === id) ?? null;
}

export function parseArenaBotInput(input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const difficulty = arenaBotDifficulty(body.difficultyId);
  if (!difficulty) throw new Error("Choose a valid bot skill level.");
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : difficulty.name;
  if (!name || name.length > 40) throw new Error("Bot names must be between 1 and 40 characters.");
  return { name, difficultyId: difficulty.id };
}
