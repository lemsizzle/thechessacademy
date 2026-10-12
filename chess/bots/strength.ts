import type { BotDifficulty, BotPersonality } from "@/chess/types";

/** Scale engine behavior as well as the rating label, using existing presets. */
export function interpolateBotStrength(rating: number, presets: readonly BotDifficulty[]): BotDifficulty {
  const upperIndex = presets.findIndex((bot) => bot.estimatedRating >= rating);
  if (upperIndex < 0 || rating < presets[0].estimatedRating) throw new Error("Bot rating outside preset range.");
  const upper = presets[upperIndex];
  const lower = presets[Math.max(0, upperIndex - 1)];
  const fraction = upper === lower ? 0 : (rating - lower.estimatedRating) / (upper.estimatedRating - lower.estimatedRating);
  const mix = (a: number, b: number) => a + (b - a) * fraction;
  return {
    ...(fraction < 0.5 ? lower : upper),
    estimatedRating: rating,
    multiPv: Math.round(mix(lower.multiPv, upper.multiPv)),
    thinkTimeMs: Math.round(mix(lower.thinkTimeMs, upper.thinkTimeMs)),
    tacticalAwareness: mix(lower.tacticalAwareness, upper.tacticalAwareness),
    complexitySensitivity: mix(lower.complexitySensitivity, upper.complexitySensitivity),
    qualityDiscipline: mix(lower.qualityDiscipline, upper.qualityDiscipline),
    selectionTemperature: mix(lower.selectionTemperature, upper.selectionTemperature),
    maxPlausibleCpLoss: mix(lower.maxPlausibleCpLoss, upper.maxPlausibleCpLoss),
    errorBands: [
      ...lower.errorBands.map((band) => ({ ...band, weight: band.weight * (1 - fraction) })),
      ...upper.errorBands.map((band) => ({ ...band, weight: band.weight * fraction }))
    ].filter((band) => band.weight > 0),
    personality: Object.fromEntries(Object.keys(lower.personality).map((key) => [
      key, mix(lower.personality[key as keyof BotPersonality], upper.personality[key as keyof BotPersonality])
    ])) as BotPersonality,
    repertoireId: undefined
  };
}
