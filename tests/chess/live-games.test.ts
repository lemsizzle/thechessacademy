import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { applyLiveMove, liveClockAt, livePlayerColor, LiveGameRuleError, replayLiveMoves, timeoutCompletion } from "@/chess/live/rules";
import type { LiveGameRecord, LiveMoveInput } from "@/chess/live/types";

const WHITE_ID = "11111111-1111-4111-8111-111111111111";
const BLACK_ID = "22222222-2222-4222-8222-222222222222";

function record(overrides: Partial<LiveGameRecord> = {}): LiveGameRecord {
  const initialFen = new Chess().fen();
  return {
    id: "33333333-3333-4333-8333-333333333333",
    challenge_code: "A7K2",
    realtime_token: "44444444-4444-4444-8444-444444444444",
    created_by: WHITE_ID,
    white_player_id: WHITE_ID,
    black_player_id: BLACK_ID,
    status: "active",
    time_control_id: "10+5",
    time_control: { id: "10+5", name: "10 + 5", initialMs: 600_000, incrementMs: 5_000 },
    initial_fen: initialFen,
    current_fen: initialFen,
    moves: [],
    version: 1,
    active_color: "white",
    white_ms: 600_000,
    black_ms: 600_000,
    clock_started_at: "2026-08-21T12:00:00.000Z",
    draw_offered_by: null,
    winner_color: null,
    result_reason: null,
    pgn: "",
    started_at: "2026-08-21T12:00:00.000Z",
    completed_at: null,
    created_at: "2026-08-21T12:00:00.000Z",
    updated_at: "2026-08-21T12:00:00.000Z",
    rated: false,
    matchmaking: false,
    rating_applied_at: null,
    arena_tournament_id: null,
    rematch_requested_by: null,
    rematch_game_id: null,
    rematch_of_game_id: null,
    ...overrides
  };
}

function play(game: LiveGameRecord, playerId: string, move: Omit<LiveMoveInput, "version">, nowMs: number) {
  const result = applyLiveMove(game, playerId, { ...move, version: game.version }, nowMs);
  return { ...game, ...result.update } as LiveGameRecord;
}

describe("live chess game rules", () => {
  it("maps only participating students to their board color", () => {
    const game = record();
    expect(livePlayerColor(game, WHITE_ID)).toBe("white");
    expect(livePlayerColor(game, BLACK_ID)).toBe("black");
    expect(livePlayerColor(game, "55555555-5555-4555-8555-555555555555")).toBeNull();
  });

  it("authoritatively validates turns, versions, and legal moves", () => {
    const game = record();
    expect(() => applyLiveMove(game, BLACK_ID, { from: "e7", to: "e5", version: 1 }, Date.parse("2026-08-21T12:00:01Z"))).toThrow("not your turn");
    expect(() => applyLiveMove(game, WHITE_ID, { from: "e2", to: "e4", version: 2 }, Date.parse("2026-08-21T12:00:01Z"))).toThrow("changed");
    expect(() => applyLiveMove(game, WHITE_ID, { from: "e2", to: "e5", version: 1 }, Date.parse("2026-08-21T12:00:01Z"))).toThrow("not legal");
  });

  it("applies elapsed time and increment before starting the opponent clock", () => {
    const game = record();
    const result = applyLiveMove(game, WHITE_ID, { from: "e2", to: "e4", version: 1 }, Date.parse("2026-08-21T12:00:02Z"));
    expect(result.savedMove.san).toBe("e4");
    expect(result.update.white_ms).toBe(603_000);
    expect(result.update.black_ms).toBe(600_000);
    expect(result.update.active_color).toBe("black");
    expect(result.update.version).toBe(2);
    expect(result.update.current_fen).toBe(result.savedMove.fenAfter);
  });

  it("detects a server-replayed checkmate and completes the game", () => {
    let game = record({ time_control_id: "none", time_control: { id: "none", name: "No Clock", initialMs: null, incrementMs: 0 }, white_ms: null, black_ms: null, clock_started_at: null });
    game = play(game, WHITE_ID, { from: "f2", to: "f3" }, 1);
    game = play(game, BLACK_ID, { from: "e7", to: "e5" }, 2);
    game = play(game, WHITE_ID, { from: "g2", to: "g4" }, 3);
    const result = applyLiveMove(game, BLACK_ID, { from: "d8", to: "h4", version: game.version }, 4);
    expect(result.completion).toEqual({ winnerColor: "black", reason: "checkmate" });
    expect(result.update.status).toBe("completed");
    expect(replayLiveMoves(game.initial_fen, [...game.moves, result.savedMove]).isCheckmate()).toBe(true);
  });

  it("derives timeout results from the canonical running clock", () => {
    const game = record({ white_ms: 1_000, black_ms: 5_000, clock_started_at: "2026-08-21T12:00:00.000Z" });
    const now = Date.parse("2026-08-21T12:00:02.000Z");
    expect(liveClockAt(game, now)).toMatchObject({ whiteMs: 0, blackMs: 5_000 });
    expect(timeoutCompletion(game, now)).toEqual({ winnerColor: "black", reason: "timeout" });
  });

  it("draws on time when the opponent has no possible checkmate", () => {
    const fen = "7k/8/8/8/8/8/7Q/7K w - - 0 1";
    const game = record({ initial_fen: fen, current_fen: fen, moves: [], white_ms: 1_000, black_ms: 5_000 });
    expect(timeoutCompletion(game, Date.parse("2026-08-21T12:00:02.000Z"))).toEqual({ winnerColor: null, reason: "timeout" });
  });

  it("counts a lone minor as mating material only when the flagged side can help block", () => {
    const bareKingFen = "7k/8/8/8/8/8/6B1/7K w - - 0 1";
    const blockingKnightFen = "7k/8/8/8/8/8/6B1/6nK w - - 0 1";
    expect(timeoutCompletion(record({ initial_fen: bareKingFen, current_fen: bareKingFen, moves: [], white_ms: 1_000, black_ms: 5_000 }), Date.parse("2026-08-21T12:00:02.000Z"))).toEqual({ winnerColor: null, reason: "timeout" });
    expect(timeoutCompletion(record({ initial_fen: blockingKnightFen, current_fen: blockingKnightFen, moves: [], white_ms: 1_000, black_ms: 5_000 }), Date.parse("2026-08-21T12:00:02.000Z"))).toEqual({ winnerColor: "black", reason: "timeout" });
  });

  it("requires timeout claims before accepting moves after flag fall", () => {
    const game = record({ white_ms: 500, clock_started_at: "2026-08-21T12:00:00.000Z" });
    expect(() => applyLiveMove(game, WHITE_ID, { from: "e2", to: "e4", version: 1 }, Date.parse("2026-08-21T12:00:01Z"))).toThrow(LiveGameRuleError);
  });
});
