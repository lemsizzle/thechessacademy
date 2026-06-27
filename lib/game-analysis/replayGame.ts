import { Chess } from "chess.js";
import { parseGameMoves } from "@/lib/game-analysis/parseGameMoves";

export type ReplayedMove = {
  moveNumber: number;
  color: "white" | "black";
  san: string;
  uci: string;
  piece: string;
  captured?: string;
  fenBefore: string;
  fenAfter: string;
  isCheck: boolean;
  isCheckmate: boolean;
};

export function replayGame(gameText: string) {
  const chess = new Chess();
  const tokens = parseGameMoves(gameText);
  const moves: ReplayedMove[] = [];

  for (const token of tokens) {
    const fenBefore = chess.fen();
    const move = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token)
      ? chess.move({ from: token.slice(0, 2), to: token.slice(2, 4), promotion: token[4] })
      : chess.move(token, { strict: false });
    if (!move) continue;
    const fenAfter = chess.fen();
    moves.push({
      moveNumber: Math.ceil(moves.length / 2 + 0.5),
      color: move.color === "w" ? "white" : "black",
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      piece: move.piece,
      captured: move.captured,
      fenBefore,
      fenAfter,
      isCheck: move.san.includes("+") || move.san.includes("#"),
      isCheckmate: move.san.includes("#") || chess.isCheckmate()
    });
  }

  return { moves, finalFen: chess.fen() };
}
