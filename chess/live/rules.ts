import { Chess } from "chess.js";
import { completeClockMove, clockAt, expiredClockColor, type RunningClock } from "@/chess/game/clock";
import { fromChessJsColor, oppositeColor } from "@/chess/game/colors";
import { canColorPossiblyCheckmate } from "@/chess/game/rules";
import type { ChessColor, GameMove, GameResultReason, PromotionPiece } from "@/chess/types";
import type { LiveGameRecord, LiveMoveInput } from "@/chess/live/types";

export class LiveGameRuleError extends Error {}

export type LiveGameCompletion = {
  winnerColor: ChessColor | null;
  reason: GameResultReason;
};

export function livePlayerColor(game: Pick<LiveGameRecord, "white_player_id" | "black_player_id">, studentId: string): ChessColor | null {
  if (game.white_player_id === studentId) return "white";
  if (game.black_player_id === studentId) return "black";
  return null;
}

export function replayLiveMoves(initialFen: string, moves: Array<Pick<GameMove, "from" | "to" | "promotion">>) {
  let chess: Chess;
  try {
    chess = new Chess(initialFen);
  } catch {
    throw new LiveGameRuleError("The live game has an invalid starting position.");
  }
  for (const [index, move] of moves.entries()) {
    try {
      chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    } catch {
      throw new LiveGameRuleError(`The live game contains an illegal move at ply ${index + 1}.`);
    }
  }
  return chess;
}

export function runningClock(game: Pick<LiveGameRecord, "white_ms" | "black_ms" | "active_color" | "clock_started_at">): RunningClock | null {
  if (game.white_ms === null || game.black_ms === null || !game.clock_started_at) return null;
  const startedAt = new Date(game.clock_started_at).getTime();
  if (!Number.isFinite(startedAt)) throw new LiveGameRuleError("The live game clock is invalid.");
  return {
    whiteMs: game.white_ms,
    blackMs: game.black_ms,
    activeColor: game.active_color,
    startedAt
  };
}

export function liveClockAt(game: Pick<LiveGameRecord, "white_ms" | "black_ms" | "active_color" | "clock_started_at">, nowMs: number) {
  const clock = runningClock(game);
  return clock ? clockAt(clock, nowMs) : null;
}

export function detectLiveBoardCompletion(chess: Chess): LiveGameCompletion | null {
  if (chess.isCheckmate()) return { winnerColor: oppositeColor(fromChessJsColor(chess.turn())), reason: "checkmate" };
  if (chess.isStalemate()) return { winnerColor: null, reason: "stalemate" };
  if (chess.isThreefoldRepetition()) return { winnerColor: null, reason: "threefold_repetition" };
  if (chess.isDrawByFiftyMoves()) return { winnerColor: null, reason: "fifty_move_rule" };
  if (chess.isInsufficientMaterial()) return { winnerColor: null, reason: "insufficient_material" };
  if (chess.isDraw()) return { winnerColor: null, reason: "draw" };
  return null;
}

export function applyLiveMove(game: LiveGameRecord, studentId: string, input: LiveMoveInput, nowMs: number) {
  if (game.status !== "active") throw new LiveGameRuleError("This game is not active.");
  if (input.version !== game.version) throw new LiveGameRuleError("The game changed. Refresh and try again.");
  const playerColor = livePlayerColor(game, studentId);
  if (!playerColor) throw new LiveGameRuleError("You are not a player in this game.");
  if (playerColor !== game.active_color) throw new LiveGameRuleError("It is not your turn.");
  if (correspondenceTimeoutCompletion(game, nowMs)) throw new LiveGameRuleError("The correspondence move deadline has expired.");

  const currentClock = runningClock(game);
  const clockBeforeMove = currentClock ? clockAt(currentClock, nowMs) : null;
  if (clockBeforeMove && expiredClockColor(clockBeforeMove)) throw new LiveGameRuleError("The clock has expired. Claim the timeout first.");

  const chess = replayLiveMoves(game.initial_fen, game.moves);
  if (chess.fen() !== game.current_fen) throw new LiveGameRuleError("The saved live position is inconsistent.");
  if (fromChessJsColor(chess.turn()) !== playerColor) throw new LiveGameRuleError("The saved turn does not match the board.");

  let move;
  try {
    move = chess.move({ from: input.from, to: input.to, promotion: input.promotion });
  } catch {
    throw new LiveGameRuleError("That move is not legal.");
  }

  const savedMove: GameMove = {
    ply: game.moves.length + 1,
    color: playerColor,
    san: move.san,
    from: move.from,
    to: move.to,
    promotion: move.promotion as PromotionPiece | undefined,
    fenAfter: chess.fen()
  };
  const completion = detectLiveBoardCompletion(chess);
  const nextClock = currentClock
    ? completeClockMove(currentClock, playerColor, game.time_control.incrementMs, nowMs)
    : null;
  const correspondenceDeadline = game.game_mode === "correspondence" && !completion
    ? new Date(nowMs + (game.days_per_move ?? 3) * 24 * 60 * 60 * 1_000).toISOString()
    : null;

  return {
    savedMove,
    completion,
    update: {
      current_fen: chess.fen(),
      moves: [...game.moves, savedMove],
      active_color: oppositeColor(playerColor),
      white_ms: nextClock?.whiteMs ?? null,
      black_ms: nextClock?.blackMs ?? null,
      clock_started_at: completion || !nextClock ? null : new Date(nowMs).toISOString(),
      draw_offered_by: null,
      status: completion ? "completed" as const : "active" as const,
      winner_color: completion?.winnerColor ?? null,
      result_reason: completion?.reason ?? null,
      completed_at: completion ? new Date(nowMs).toISOString() : null,
      turn_deadline_at: correspondenceDeadline,
      version: game.version + 1
    },
    chess
  };
}

export function correspondenceTimeoutCompletion(game: LiveGameRecord, nowMs: number): LiveGameCompletion | null {
  if (game.status !== "active" || game.game_mode !== "correspondence" || !game.turn_deadline_at) return null;
  const deadlineMs = Date.parse(game.turn_deadline_at);
  if (!Number.isFinite(deadlineMs)) throw new LiveGameRuleError("The correspondence deadline is invalid.");
  if (nowMs < deadlineMs) return null;
  return { winnerColor: oppositeColor(game.active_color), reason: "timeout" };
}

export function timeoutCompletion(game: LiveGameRecord, nowMs: number): LiveGameCompletion | null {
  if (game.status !== "active") return null;
  const current = liveClockAt(game, nowMs);
  if (!current) return null;
  const expired = expiredClockColor(current);
  if (!expired) return null;
  const candidateWinner = oppositeColor(expired);
  const chess = replayLiveMoves(game.initial_fen, game.moves);
  return { winnerColor: canColorPossiblyCheckmate(chess, candidateWinner) ? candidateWinner : null, reason: "timeout" };
}
