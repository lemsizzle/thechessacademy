import { Chess } from "chess.js";
import type { BotDifficulty } from "@/chess/types";

/** Limit opening choices, not search time or the bot's overall strength. */
export function openingMoveChoices(fen: string, bot: Pick<BotDifficulty, "estimatedRating">): string[] | null {
  // FEN's fullmove counter covers both White's and Black's first two turns,
  // including resumed games whose in-memory move history may be empty.
  if (bot.estimatedRating <= 500 || Number(fen.split(" ")[5]) > 2) return null;
  const moves = new Chess(fen).moves({ verbose: true });
  const choices = moves.filter(move => !(move.piece === "p" && (move.from[0] === "a" || move.from[0] === "h") && !move.isCapture()));
  // Never remove the only legal reply (for example, blocking a check).
  return choices.length ? choices.map(move => `${move.from}${move.to}${move.promotion ?? ""}`) : null;
}
