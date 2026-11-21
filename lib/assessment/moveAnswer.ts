import { Chess } from "chess.js";

// Validate a proposed answer independently of the answer key. Legal wrong moves
// must be saved too; correctness is revealed only after the test finishes.
export function assessmentMove(fen: string, answer: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(answer)) return null;
  try {
    const game = new Chess(fen);
    const move = game.move({ from: answer.slice(0, 2), to: answer.slice(2, 4), ...(answer[4] ? { promotion: answer[4] } : {}) });
    if (move.from + move.to + (move.promotion || "") !== answer) return null;
    return { fen: game.fen(), san: move.san, from: move.from, to: move.to };
  } catch { return null; }
}
