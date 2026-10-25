import { Chess, DEFAULT_POSITION } from "chess.js";
import { HALLOWEEN_BOTS, HALLOWEEN_END } from "@/lib/quests/halloween";

export const HALLOWEEN_ADAPTATION_START = "2026-10-26T00:00:00+07:00";
export const HALLOWEEN_RATING_STEP = 25;
export const HALLOWEEN_MAX_REDUCTION = 200;
export type HalloweenReductions = Partial<Record<string, number>>;

export type HalloweenLossRecord = {
  id: string; opponent_id: string; player_color: string; result: string;
  result_reason: string; initial_fen: string; pgn: string;
  takeback_count: number; hints_used: number;
  started_at: string; completed_at: string; created_at: string;
};

/** Saved games have already been replayed/validated by the completion endpoint.
 * These are farming deterrents, not a claim that we can infer a player's intent.
 * Server-created timestamps control daily limits; replay fingerprints stop retries
 * or duplicate uploads from earning additional reductions.
 */
export function halloweenReductionsFromGames(games: readonly HalloweenLossRecord[]): HalloweenReductions {
  const reductions: HalloweenReductions = {};
  const seen = new Set<string>();
  const daily = new Map<string, number>();
  const lastAccepted = new Map<string, number>();
  const sorted = [...games].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  for (const game of sorted) {
    if (!HALLOWEEN_BOTS.some((bot) => bot.id === game.opponent_id)
      || game.result !== "loss" || game.result_reason !== "checkmate"
      || game.takeback_count !== 0 || game.hints_used !== 0
      || game.initial_fen !== DEFAULT_POSITION
      || !["white", "black"].includes(game.player_color)) continue;
    const start = Date.parse(game.started_at), end = Date.parse(game.completed_at), saved = Date.parse(game.created_at);
    if (![start, end, saved].every(Number.isFinite)
      || start < Date.parse(HALLOWEEN_ADAPTATION_START) || saved >= Date.parse(HALLOWEEN_END)
      || end - start < 120_000 || end > saved + 60_000 || saved - start < 120_000) continue;
    if ((reductions[game.opponent_id] ?? 0) >= HALLOWEEN_MAX_REDUCTION) continue;
    const day = new Date(saved + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dailyKey = `${game.opponent_id}:${day}`;
    if ((daily.get(dailyKey) ?? 0) >= 2 || saved - (lastAccepted.get(game.opponent_id) ?? 0) < 120_000) continue;
    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      const moves = chess.history({ verbose: true });
      const playerColor = game.player_color === "white" ? "w" : "b";
      const studentMoves = moves.filter((move) => move.color === playerColor);
      if (moves[0]?.before !== DEFAULT_POSITION || !chess.isCheckmate() || chess.turn() !== playerColor
        || studentMoves.length < 12 || new Set(studentMoves.map((move) => move.from)).size < 4) continue;
      const fingerprint = `${game.opponent_id}:${playerColor}:${moves.map((m) => m.from + m.to + (m.promotion ?? "")).join(",")}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      daily.set(dailyKey, (daily.get(dailyKey) ?? 0) + 1);
      lastAccepted.set(game.opponent_id, saved);
      reductions[game.opponent_id] = (reductions[game.opponent_id] ?? 0) + HALLOWEEN_RATING_STEP;
    } catch {
      // Malformed historical records do not affect difficulty or block Play.
    }
  }
  return reductions;
}
