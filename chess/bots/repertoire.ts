import { Chess } from "chess.js";
import type { BotRepertoire } from "@/chess/types";

/** Preserve side, castling and legal en passant; ignore only the move counters. */
export function repertoirePositionKey(chess: Chess) {
  return chess.fen().split(" ").slice(0, 4).join(" ");
}

/** Sample the player's real choices, independently of Stockfish rank/error bands. */
export function selectRepertoireMove(fen: string, repertoire: BotRepertoire, random = Math.random): string | null {
  const chess = new Chess(fen);
  if (chess.isGameOver()) return null;
  const choices = repertoire[repertoirePositionKey(chess)];
  if (!choices?.length) return null;
  const legal = new Set(chess.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`));
  const supported = choices.filter((choice) => legal.has(choice.uci) && Number.isFinite(choice.weight) && choice.weight > 0);
  const total = supported.reduce((sum, choice) => sum + choice.weight, 0);
  if (!supported.length || !Number.isFinite(total)) return null;
  const sample = random();
  let cursor = Math.max(0, Math.min(0.999999999, Number.isFinite(sample) ? sample : 0)) * total;
  for (const choice of supported) {
    cursor -= choice.weight;
    if (cursor < 0) return choice.uci;
  }
  return supported.at(-1)!.uci;
}
