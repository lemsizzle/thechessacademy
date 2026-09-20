export const LOSS_ENCOURAGEMENTS = [
  "Losing can feel tough. Take a breath—one game doesn't define you.",
  "Every chess player loses games. Pick one moment to learn from and keep going.",
  "Your next discovery could start with this game. What would you try differently?",
  "You don't have to get every move right to grow. One small lesson is a great start.",
  "Even strong players miss threats. Reviewing one tricky move can help you spot it next time.",
  "It's okay to feel disappointed. Take a break when you need one—the board will be here.",
  "A loss is part of learning chess. Find one idea from this game to bring to your next adventure.",
  "Be kind to yourself. Learning to spot a new pattern takes practice.",
  "Stay curious: what was your opponent's best idea? You can learn from it too.",
  "This game is over, but your chess journey continues. Take your time and try again when you're ready."
] as const;

let nextIndex = 0;
const STORAGE_KEY = "chessquest.loss-encouragement-index";

export function nextLossEncouragement() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored === null ? nextIndex : Number(stored);
    if (Number.isSafeInteger(parsed) && parsed >= 0) nextIndex = parsed % LOSS_ENCOURAGEMENTS.length;
  } catch { /* Keep rotating in memory when storage is unavailable. */ }
  const message = LOSS_ENCOURAGEMENTS[nextIndex];
  nextIndex = (nextIndex + 1) % LOSS_ENCOURAGEMENTS.length;
  try { window.localStorage.setItem(STORAGE_KEY, String(nextIndex)); } catch { /* Storage is optional. */ }
  return message;
}
