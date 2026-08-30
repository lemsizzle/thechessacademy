import { Chess, type PieceSymbol, type Square } from "chess.js";
import type { ChessColor, PromotionPiece } from "@/chess/types";

export type LivePremove = {
  from: string;
  to: string;
  promotion?: PromotionPiece;
};

const files = "abcdefgh";

type PremoveCandidate = {
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
};

function squareAt(file: number, rank: number) {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${files[file]}${rank + 1}` as Square;
}

/**
 * Returns geometrically possible destinations while the opponent is moving.
 * Final legality is always checked again against the server-confirmed reply.
 */
export function premoveMovesFrom(chess: Chess, square: string): PremoveCandidate[] {
  const from = square as Square;
  const piece = chess.get(from);
  if (!piece) return [];

  const file = files.indexOf(from[0]);
  const rank = Number(from[1]) - 1;
  const moves: PremoveCandidate[] = [];
  const addTarget = (targetFile: number, targetRank: number) => {
    const to = squareAt(targetFile, targetRank);
    if (!to) return;
    const target = chess.get(to);
    if (target?.color === piece.color || target?.type === "k") return;
    moves.push({ from, to, piece: piece.type, captured: target?.type });
  };
  const addRay = (fileStep: number, rankStep: number) => {
    let targetFile = file + fileStep;
    let targetRank = rank + rankStep;
    while (true) {
      const to = squareAt(targetFile, targetRank);
      if (!to) return;
      const target = chess.get(to);
      if (target) {
        if (target.color !== piece.color && target.type !== "k") {
          moves.push({ from, to, piece: piece.type, captured: target.type });
        }
        return;
      }
      moves.push({ from, to, piece: piece.type });
      targetFile += fileStep;
      targetRank += rankStep;
    }
  };

  if (piece.type === "p") {
    const direction = piece.color === "w" ? 1 : -1;
    const oneForward = squareAt(file, rank + direction);
    if (oneForward && !chess.get(oneForward)) {
      moves.push({ from, to: oneForward, piece: "p" });
      const startingRank = piece.color === "w" ? 1 : 6;
      const twoForward = squareAt(file, rank + direction * 2);
      if (rank === startingRank && twoForward && !chess.get(twoForward)) {
        moves.push({ from, to: twoForward, piece: "p" });
      }
    }
    // Capture premoves remain useful when the target square is currently empty.
    for (const fileStep of [-1, 1]) {
      const to = squareAt(file + fileStep, rank + direction);
      if (!to) continue;
      const target = chess.get(to);
      if (!target || target.color !== piece.color) {
        moves.push({ from, to, piece: "p", captured: target?.type });
      }
    }
  } else if (piece.type === "n") {
    for (const [fileStep, rankStep] of [[1, -2], [-1, -2], [2, -1], [-2, -1], [2, 1], [-2, 1], [1, 2], [-1, 2]]) {
      addTarget(file + fileStep, rank + rankStep);
    }
  } else if (piece.type === "k") {
    for (const [fileStep, rankStep] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      addTarget(file + fileStep, rank + rankStep);
    }
  } else {
    const straight = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const diagonal = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    const directions = piece.type === "r" ? straight : piece.type === "b" ? diagonal : [...straight, ...diagonal];
    for (const [fileStep, rankStep] of directions) addRay(fileStep, rankStep);
  }

  if (piece.type === "k" && (from === "e1" || from === "e8")) {
    const rank = from[1];
    const candidates = [
      { to: `g${rank}` as Square, rook: `h${rank}` as Square, clear: [`f${rank}`, `g${rank}`] as Square[] },
      { to: `c${rank}` as Square, rook: `a${rank}` as Square, clear: [`b${rank}`, `c${rank}`, `d${rank}`] as Square[] }
    ];
    for (const candidate of candidates) {
      const rook = chess.get(candidate.rook);
      if (rook?.type === "r" && rook.color === piece.color && candidate.clear.every((target) => !chess.get(target))) {
        moves.push({ from, to: candidate.to, piece: "k" });
      }
    }
  }

  return moves.filter((move, index) => moves.findIndex((candidate) => candidate.to === move.to) === index);
}

export function isPremovePromotion(chess: Chess, color: ChessColor, from: string, to: string) {
  const piece = chess.get(from as Square);
  return piece?.type === "p"
    && piece.color === (color === "white" ? "w" : "b")
    && to[1] === (color === "white" ? "8" : "1");
}

export function canPlayPremove(fen: string, premove: LivePremove) {
  try {
    const chess = new Chess(fen);
    return Boolean(chess.move(premove));
  } catch {
    return false;
  }
}
