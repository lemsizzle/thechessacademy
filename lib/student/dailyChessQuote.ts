const dailyChessQuotes = [
  "Every strong move begins with a clear idea.",
  "The board rewards the player who keeps looking for one better move.",
  "A mistake is not the end of the game; it is the start of the lesson.",
  "Build your position patiently, then play with courage.",
  "Great players are made one thoughtful move at a time.",
  "When the position gets difficult, slow down and find the purpose in every piece.",
  "Your next breakthrough may be hiding one move deeper.",
  "Train your eyes to see the opportunity before your hands make the move.",
  "A calm mind can turn a complicated board into a clear plan.",
  "Protect your king, improve your pieces, and trust your preparation.",
  "Chess strength grows whenever curiosity is stronger than frustration.",
  "Look at the whole board; the best idea may be far from the action.",
  "Play the position in front of you, not the mistake behind you.",
  "Small improvements create winning positions.",
] as const;

const millisecondsPerDay = 24 * 60 * 60 * 1_000;

export function getDailyChessQuote(date = new Date()) {
  const utcDay = Math.floor(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ) / millisecondsPerDay);

  return dailyChessQuotes[utcDay % dailyChessQuotes.length];
}
