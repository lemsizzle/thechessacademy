import type { ChessColor } from "@/chess/types";

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

export function whiteMaterialAdvantage(fen: string) {
  const placement = fen.trim().split(/\s+/)[0] ?? "";
  let balance = 0;

  for (const piece of placement) {
    const value = PIECE_VALUES[piece.toLowerCase()];
    if (value === undefined) continue;
    balance += piece === piece.toUpperCase() ? value : -value;
  }

  return balance;
}

export function materialAdvantageForColor(whiteAdvantage: number, color: ChessColor) {
  return color === "white" ? whiteAdvantage : -whiteAdvantage;
}
