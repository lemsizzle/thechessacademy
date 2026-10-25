import { Chess } from "chess.js";
import { selectHumanLikeMove } from "./humanMoveSelector";
import type { BotDifficulty, BotMoveContext, StockfishCandidate } from "@/chess/types";

/** Failure-only path: prefer finished analysis lines, otherwise a shallow legal evaluation. */
export function chooseBotRecoveryMove(fen: string, bot: BotDifficulty, context: BotMoveContext, candidates: StockfishCandidate[] = []) {
  if (candidates.length) {
    try { return selectHumanLikeMove({ fen, candidates, bot, context }); } catch { /* Discard invalid/stale engine lines. */ }
  }
  const chess = new Chess(fen);
  const side = chess.turn();
  const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const choices: StockfishCandidate[] = chess.moves({ verbose: true }).map(move => {
    chess.move(move);
    const mate = chess.isCheckmate();
    let score = 0;
    for (const row of chess.board()) for (const piece of row) {
      if (piece) score += values[piece.type] * (piece.color === side ? 1 : -1);
    }
    // Avoid dropping the moved piece undefended when the engine is unavailable.
    if (!mate && chess.isAttacked(move.to, chess.turn())) score -= values[move.promotion ?? move.piece];
    chess.undo();
    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    return { uci, rank: 0, depth: 0, scoreCp: mate ? 100000 : score, mate: mate ? 1 : null, pv: [uci] };
  });
  choices.sort((a, b) => (b.scoreCp ?? 0) - (a.scoreCp ?? 0));
  choices.forEach((choice, index) => { choice.rank = index + 1; });
  return selectHumanLikeMove({ fen, candidates: choices, bot, context });
}
