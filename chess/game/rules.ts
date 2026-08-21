import { Chess, type Move, type Square } from "chess.js";
import { chessJsColor, fromChessJsColor, oppositeColor } from "@/chess/game/config";
import type { ChessColor, GameMove, GameOutcome, GameResultReason, PromotionPiece } from "@/chess/types";

export type MoveInput = { from: string; to: string; promotion?: PromotionPiece };

export function legalMovesFrom(chess: Chess, square: string) {
  return chess.moves({ square: square as Square, verbose: true });
}
export function promotionOptions(chess: Chess, from: string, to: string): PromotionPiece[] {
  const options = legalMovesFrom(chess, from)
    .filter((move) => move.to === to && move.promotion)
    .map((move) => move.promotion as PromotionPiece);
  return [...new Set(options)];
}

export function tryMove(chess: Chess, input: MoveInput): Move | null {
  try {
    return chess.move(input);
  } catch {
    return null;
  }
}

export function checkedKingSquare(chess: Chess): string | null {
  if (!chess.inCheck()) return null;
  const color = chess.turn();
  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (piece?.type === "k" && piece.color === color) return piece.square;
    }
  }
  return null;
}

function outcomeText(reason: GameResultReason, result: GameOutcome["result"]) {
  if (reason === "checkmate") return result === "win" ? ["Checkmate", "You won!"] : ["Checkmate", "The computer won this game."];
  if (reason === "stalemate") return ["Draw by stalemate", "No legal moves remain, but the king is not in check."];
  if (reason === "threefold_repetition") return ["Draw by repetition", "The same position appeared three times."];
  if (reason === "fifty_move_rule") return ["Draw by fifty-move rule", "Fifty moves passed without a pawn move or capture."];
  if (reason === "insufficient_material") return ["Draw by insufficient material", "There is not enough material left to checkmate."];
  if (reason === "resignation") return result === "win" ? ["Victory by resignation", "The computer resigned."] : ["Game resigned", "You resigned this game."];
  if (reason === "timeout") return result === "win" ? ["Victory on time", "The computer's clock ran out."] : ["Time expired", "Your clock ran out."];
  return ["Draw", "The game ended in a draw."];
}

export function createOutcome(reason: GameResultReason, winnerColor: ChessColor | null, humanColor: ChessColor): GameOutcome {
  const result = winnerColor === null ? "draw" : winnerColor === humanColor ? "win" : "loss";
  const [title, message] = outcomeText(reason, result);
  return { reason, winnerColor, result, title, message };
}

export function detectBoardOutcome(chess: Chess, humanColor: ChessColor): GameOutcome | null {
  if (chess.isCheckmate()) {
    const losingColor = fromChessJsColor(chess.turn());
    return createOutcome("checkmate", oppositeColor(losingColor), humanColor);
  }
  if (chess.isStalemate()) return createOutcome("stalemate", null, humanColor);
  if (chess.isThreefoldRepetition()) return createOutcome("threefold_repetition", null, humanColor);
  if (chess.isDrawByFiftyMoves()) return createOutcome("fifty_move_rule", null, humanColor);
  if (chess.isInsufficientMaterial()) return createOutcome("insufficient_material", null, humanColor);
  if (chess.isDraw()) return createOutcome("draw", null, humanColor);
  return null;
}

export function undoComputerTurn(chess: Chess, humanColor: ChessColor) {
  const humanTurn = chessJsColor(humanColor);
  const undone: Move[] = [];
  if (chess.turn() === humanTurn && chess.history().length) {
    const engineMove = chess.undo();
    if (engineMove) undone.push(engineMove);
  }
  if (chess.turn() !== humanTurn && chess.history().length) {
    const humanMove = chess.undo();
    if (humanMove) undone.push(humanMove);
  }
  return undone;
}

export function hasHumanMove(chess: Chess, humanColor: ChessColor) {
  const color = chessJsColor(humanColor);
  return chess.history({ verbose: true }).some((move) => move.color === color);
}

export function gameMoves(chess: Chess): GameMove[] {
  const replay = new Chess();
  return chess.history({ verbose: true }).map((move, index) => {
    replay.move({ from: move.from, to: move.to, promotion: move.promotion });
    return {
      ply: index + 1,
      color: fromChessJsColor(move.color),
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion as PromotionPiece | undefined,
      fenAfter: replay.fen()
    };
  });
}

export function resultHeader(outcome: GameOutcome) {
  if (outcome.winnerColor === "white") return "1-0";
  if (outcome.winnerColor === "black") return "0-1";
  return "1/2-1/2";
}
