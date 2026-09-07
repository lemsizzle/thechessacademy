import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import type { BotDifficulty, BotPersonality, ChessColor } from "@/chess/types";

export const MAX_ARENA_BOTS = 12;
export const ARENA_BOT_MIN_RATING = 375;
export const ARENA_BOT_MAX_RATING = 1600;
export const ARENA_BOT_RATING_STEP = 25;
export type ArenaBot = { id: string; name: string; difficultyId: string; removed?: boolean };
export type ArenaGameBot = ArenaBot & { color: ChessColor };

export function arenaGameBots(game: { arena_bot?: ArenaGameBot | null; arena_opponent_bot?: ArenaGameBot | null }): ArenaGameBot[] {
  return [game.arena_bot, game.arena_opponent_bot].filter((bot): bot is ArenaGameBot => Boolean(bot));
}

export function arenaBotRatingId(rating: number): string {
  if (!Number.isInteger(rating) || rating < ARENA_BOT_MIN_RATING || rating > ARENA_BOT_MAX_RATING || rating % ARENA_BOT_RATING_STEP !== 0) {
    throw new Error("Choose a bot rating from 375 to 1600 in steps of 25.");
  }
  return `arena-${rating}`;
}

/** Interpolate the existing human-like engine settings, not just the displayed rating. */
function scaledDifficulty(rating: number): BotDifficulty {
  const upperIndex = BOT_DIFFICULTIES.findIndex((bot) => bot.estimatedRating >= rating);
  const upper = BOT_DIFFICULTIES[upperIndex];
  const lower = BOT_DIFFICULTIES[Math.max(0, upperIndex - 1)];
  const fraction = upper === lower ? 0 : (rating - lower.estimatedRating) / (upper.estimatedRating - lower.estimatedRating);
  const mix = (a: number, b: number) => a + (b - a) * fraction;
  const nearest = fraction < 0.5 ? lower : upper;
  const personality = Object.fromEntries(Object.keys(lower.personality).map((key) => [
    key, mix(lower.personality[key as keyof BotPersonality], upper.personality[key as keyof BotPersonality])
  ])) as BotPersonality;
  return {
    ...nearest,
    id: arenaBotRatingId(rating),
    name: "Academy Bot",
    title: "Custom strength",
    estimatedRating: rating,
    multiPv: Math.round(mix(lower.multiPv, upper.multiPv)),
    thinkTimeMs: Math.round(mix(lower.thinkTimeMs, upper.thinkTimeMs)),
    tacticalAwareness: mix(lower.tacticalAwareness, upper.tacticalAwareness),
    complexitySensitivity: mix(lower.complexitySensitivity, upper.complexitySensitivity),
    qualityDiscipline: mix(lower.qualityDiscipline, upper.qualityDiscipline),
    selectionTemperature: mix(lower.selectionTemperature, upper.selectionTemperature),
    maxPlausibleCpLoss: mix(lower.maxPlausibleCpLoss, upper.maxPlausibleCpLoss),
    // A weighted mixture also works when adjacent presets have different error bands.
    errorBands: [
      ...lower.errorBands.map((band) => ({ ...band, weight: band.weight * (1 - fraction) })),
      ...upper.errorBands.map((band) => ({ ...band, weight: band.weight * fraction }))
    ].filter((band) => band.weight > 0),
    personality,
    // Recorded Sir Lem moves bypass strength selection: reserve them for his named preset.
    repertoireId: undefined,
    description: `Custom Arena strength, approximately ${rating}. This is an estimate, not a measured Elo rating.`
  };
}

const scaledDifficulties = new Map(Array.from(
  { length: (ARENA_BOT_MAX_RATING - ARENA_BOT_MIN_RATING) / ARENA_BOT_RATING_STEP + 1 },
  (_, index) => {
    const difficulty = scaledDifficulty(ARENA_BOT_MIN_RATING + index * ARENA_BOT_RATING_STEP);
    return [difficulty.id, difficulty] as const;
  }
));

export function arenaBotDifficulty(id: unknown): BotDifficulty | null {
  return BOT_DIFFICULTIES.find((bot) => bot.id === id) ?? (typeof id === "string" ? scaledDifficulties.get(id) : null) ?? null;
}

export function parseArenaBotInput(input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const difficulty = arenaBotDifficulty(body.difficultyId);
  if (!difficulty) throw new Error("Choose a valid bot skill level.");
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : difficulty.name;
  if (!name || name.length > 40) throw new Error("Bot names must be between 1 and 40 characters.");
  return { name, difficultyId: difficulty.id };
}
