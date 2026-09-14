import { Chess, type Square } from "chess.js";

/** Translate a king dropped on its rook into a legal standard castling move. */
export function castlingDropTarget(position: unknown, from: string, to: string): string {
  if (typeof position !== "string" || !/^e[18]$/.test(from) || !/^[ah][18]$/.test(to) || from[1] !== to[1]) return to;
  try {
    const chess = new Chess(position);
    const king = chess.get(from as Square);
    const rook = chess.get(to as Square);
    if (king?.type !== "k" || rook?.type !== "r" || king.color !== rook.color) return to;
    const flag = to[0] === "h" ? "k" : "q";
    return chess.moves({ square: from as Square, verbose: true }).find(move => move.flags.includes(flag))?.to ?? to;
  } catch {
    // Incomplete teaching positions keep their existing move handling.
    return to;
  }
}
