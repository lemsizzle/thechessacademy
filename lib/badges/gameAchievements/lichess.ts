import { DEFAULT_POSITION } from "chess.js";
import type { RawLichessGame } from "@/lib/lichess/fetchStudentGamesForWindow";
import type { AchievementGame } from "./detect";

/** Convert only completed, standard games belonging to the linked account. */
export function lichessAchievementInput(game: RawLichessGame, username: string): AchievementGame | null {
  const id = username.trim().toLowerCase();
  const player = (color: "white" | "black") => [
    game.players?.[color]?.user?.id, game.players?.[color]?.user?.name,
    game.players?.[color]?.userId, game.players?.[color]?.name
  ].some(v => v?.toLowerCase() === id);
  if (!id || !/^[a-zA-Z0-9]{8}$/.test(game.id ?? "") || !game.moves ||
      !Number.isFinite(game.createdAt) || !Number.isFinite(game.lastMoveAt) ||
      game.lastMoveAt! < game.createdAt! ||
      !["mate", "resign", "stalemate", "timeout", "outoftime", "draw"].includes(game.status ?? "") ||
      (game.variant && game.variant !== "standard") ||
      (game.initialFen && game.initialFen !== DEFAULT_POSITION)) return null;
  const color = player("white") ? "w" : player("black") ? "b" : null;
  if (!color) return null;
  return {
    moves: game.moves, color, winner: game.winner ? game.winner === "white" ? "w" : "b" : null,
    // Lichess `timeout` is leaving the game; only `outoftime` means the clock ran out.
    reason: game.status === "mate" ? "checkmate" : game.status === "outoftime" ? "timeout" : game.status === "timeout" ? "abandonment" : game.status!,
    incrementMs: typeof game.clock?.increment === "number" ? game.clock.increment * 1000 : undefined,
    clocksMs: game.clocks?.map(n => Number.isFinite(n) && n >= 0 ? n * 10 : null)
  };
}
