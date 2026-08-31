import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { pseudoLegalMovesFrom } from "@/chess/game/rules";

export function blackPiecesRemaining(chess: Chess) {
  return chess.board().flat().filter((piece) => piece?.color === "b" && piece.type !== "k").length;
}

export type FundamentalCapture = {
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured: PieceSymbol;
};

const files = "abcdefgh";

function squareAt(file: number, rank: number) {
  return `${files[file]}${rank + 1}` as Square;
}

function pieceCaptures(chess: Chess, from: Square, includeKingTargets = false): FundamentalCapture[] {
  return pseudoLegalMovesFrom(chess, from, includeKingTargets)
    .filter((move): move is typeof move & { captured: PieceSymbol } => Boolean(move.captured));
}

function visiblePieces(chess: Chess, color: Color, allowedSquares?: readonly string[]) {
  const pieces: Array<{ square: Square; type: PieceSymbol }> = [];
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = squareAt(file, rank);
      const piece = chess.get(square);
      if (piece?.color === color && piece.type !== "k" && (!allowedSquares || allowedSquares.includes(square))) {
        pieces.push({ square, type: piece.type });
      }
    }
  }
  return pieces;
}

function canWhiteRecapture(chess: Chess, capture: FundamentalCapture) {
  const afterCapture = new Chess(chess.fen());
  afterCapture.remove(capture.from);
  afterCapture.remove(capture.to);
  afterCapture.put({ color: "b", type: capture.piece }, capture.to);
  return visiblePieces(afterCapture, "w").some(({ square }) => (
    pieceCaptures(afterCapture, square).some((reply) => reply.to === capture.to)
  ));
}

/**
 * These Lichess-style boards intentionally omit kings. Evaluate only the
 * visible pieces so the hidden chess.js support kings cannot create false pins.
 */
export function findUnprotectedBlackCapture(chess: Chess, opponentSquares?: readonly string[]) {
  const captures = visiblePieces(chess, "b", opponentSquares)
    .flatMap(({ square }) => pieceCaptures(chess, square));
  return captures.find((capture) => !canWhiteRecapture(chess, capture)) ?? null;
}

export function findVisibleBlackAttack(chess: Chess, target: string, opponentSquares?: readonly string[]) {
  return visiblePieces(chess, "b", opponentSquares)
    .flatMap(({ square }) => pieceCaptures(chess, square, true))
    .find((capture) => capture.to === target) ?? null;
}

export function hasUnprotectedBlackCapture(chess: Chess, opponentSquares?: readonly string[]) {
  return Boolean(findUnprotectedBlackCapture(chess, opponentSquares));
}
