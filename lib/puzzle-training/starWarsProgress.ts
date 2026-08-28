export const STAR_WARS_BEST_SCORE_STORAGE_KEY = "academy-star-wars-best-score:v1";

export function parseStoredStarWarsBestScore(value: string | null) {
  const score = Number(value);
  return Number.isInteger(score) && score > 0 ? score : 0;
}
