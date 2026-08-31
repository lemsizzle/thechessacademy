import type { Square } from "chess.js";
import type { ChessColor } from "@/chess/types";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
const PIECE_NAMES = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king"
} as const;

type AccessiblePiece = {
  color: "w" | "b";
  type: keyof typeof PIECE_NAMES;
} | null;

export type BoardSquareDescription = {
  square: Square;
  piece: AccessiblePiece;
  selected?: boolean;
  selectable?: boolean;
  legalDestination?: boolean;
  legalCapture?: boolean;
  inCheck?: boolean;
  lastMove?: "start" | "end" | null;
};

export type BoardNavigationKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";

export function boardSquaresForOrientation(orientation: ChessColor) {
  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = orientation === "white" ? [...RANKS].reverse() : RANKS;
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}` as Square));
}

export function describeBoardSquare({ square, piece, selected, selectable, legalDestination, legalCapture, inCheck, lastMove }: BoardSquareDescription) {
  const parts = [square, piece ? `${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}` : "empty"];
  if (selected) parts.push("selected");
  else if (legalCapture) parts.push("legal capture");
  else if (legalDestination) parts.push("legal destination");
  else if (selectable) parts.push("selectable");
  if (inCheck) parts.push("in check");
  if (lastMove === "start") parts.push("last move started here");
  if (lastMove === "end") parts.push("last move ended here");
  return parts.join(", ");
}

export function nextBoardSquare(squares: Square[], current: Square, key: BoardNavigationKey) {
  const index = Math.max(0, squares.indexOf(current));
  const row = Math.floor(index / 8);
  const column = index % 8;
  if (key === "Home") return squares[row * 8];
  if (key === "End") return squares[row * 8 + 7];
  if (key === "ArrowLeft") return squares[row * 8 + Math.max(0, column - 1)];
  if (key === "ArrowRight") return squares[row * 8 + Math.min(7, column + 1)];
  if (key === "ArrowUp") return squares[Math.max(0, row - 1) * 8 + column];
  return squares[Math.min(7, row + 1) * 8 + column];
}
