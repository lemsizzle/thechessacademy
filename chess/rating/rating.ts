export const STARTING_CHESS_RATING = 1200;
export const PROVISIONAL_GAME_COUNT = 10;
export const PROVISIONAL_K_FACTOR = 40;
export const ESTABLISHED_K_FACTOR = 24;

export function expectedChessScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function chessRatingChange(playerRating: number, opponentRating: number, score: 0 | 0.5 | 1, ratedGames: number) {
  const kFactor = ratedGames < PROVISIONAL_GAME_COUNT ? PROVISIONAL_K_FACTOR : ESTABLISHED_K_FACTOR;
  return Math.round(kFactor * (score - expectedChessScore(playerRating, opponentRating)));
}

export function chessRatingBand(rating: number) {
  if (rating >= 1800) return "Master Scholar";
  if (rating >= 1600) return "Academy Expert";
  if (rating >= 1400) return "Advanced Knight";
  if (rating >= 1200) return "Club Player";
  if (rating >= 1000) return "Rising Challenger";
  return "New Challenger";
}
