import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import type { LiveGameRecord } from "@/chess/live/types";
import { applyLiveMove } from "@/chess/live/rules";

const mocks = vi.hoisted(() => ({ client: vi.fn(), choose: vi.fn(), finalize: vi.fn(), schedule: vi.fn(), rating: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({ getStudentAvatarDisplayData: async () => ({ avatars: {}, items: [] }) }));
vi.mock("@/chess/engine/arenaStockfishServer", () => ({ chooseArenaBotMove: mocks.choose }));
vi.mock("@/chess/persistence/arenaServer", () => ({ finalizeInternalArenaGame: mocks.finalize, scheduleArenaBotTurn: mocks.schedule }));
vi.mock("@/chess/persistence/ratingServer", () => ({ applyRatingForCompletedGame: mocks.rating }));
import { advanceArenaBotGame, getLiveGame, getTeacherLiveGame, performLiveGameAction, submitLiveMove } from "@/chess/persistence/liveGameServer";

const student = "11111111-1111-4111-8111-111111111111";
const botId = "22222222-2222-4222-8222-222222222222";
const gameId = "33333333-3333-4333-8333-333333333333";
let game: LiveGameRecord;
let history: Record<string, unknown>[];

function fixture(color: "white" | "black" = "black"): LiveGameRecord {
  const now = new Date().toISOString();
  return {
    id: gameId, challenge_code: "ABCD", realtime_token: "opaque", created_by: student,
    white_player_id: color === "black" ? student : null, black_player_id: color === "white" ? student : null,
    arena_bot: { id: botId, color, name: "Class Bot", difficultyId: "knight" },
    game_mode: "live", days_per_move: null, turn_deadline_at: null, status: "active", time_control_id: "10m",
    time_control: { id: "10m", name: "10 min", initialMs: 600000, incrementMs: 0 },
    initial_fen: new Chess().fen(), current_fen: new Chess().fen(), moves: [], version: 1, active_color: "white",
    white_ms: 600000, black_ms: 600000, clock_started_at: now, started_at: now, completed_at: null,
    draw_offered_by: null, winner_color: null, result_reason: null, pgn: "", created_at: now, updated_at: now,
    rated: false, matchmaking: true, rating_applied_at: null, arena_tournament_id: "44444444-4444-4444-8444-444444444444",
    rematch_requested_by: null, rematch_game_id: null, rematch_of_game_id: null
  };
}

function query(table: string) {
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];
  let update: Record<string, unknown> | null = null;
  let insert: Record<string, unknown>[] | null = null;
  const api = {
    select: () => api,
    eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return api; },
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return api; },
    update: (value: Record<string, unknown>) => { update = value; return api; },
    insert: (value: Record<string, unknown>[]) => { insert = value; return api; },
    maybeSingle: async () => { const result = execute(); return { ...result, data: result.data[0] ?? null }; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve)
  };
  function execute() {
    let rows: Record<string, unknown>[] = table === "live_chess_games" ? [game] : table === "students" ? [{ id: student, display_name: "Learner", lichess_username: null }] : history;
    rows = rows.filter(row => filters.every(filter => filter(row)));
    if (update && rows.length && table === "live_chess_games") { game = { ...game, ...update }; rows = [game]; }
    if (insert && table === "internal_chess_games") { history.push(...insert); rows = insert; }
    return { data: rows, error: null };
  }
  return api;
}

beforeEach(() => {
  vi.clearAllMocks(); game = fixture(); history = [];
  mocks.client.mockReturnValue({ from: query, rpc: async () => {
    if (game.status !== "active" || game.bot_lease_until) return { data: [], error: null };
    game = { ...game, bot_lease_until: new Date(Date.now()+15000).toISOString() };
    return { data: [structuredClone(game)], error: null };
  } });
  mocks.choose.mockResolvedValue("e7e5");
});

describe("authoritative Arena bot game flow", () => {
  it.each(["white", "black"] as const)("shows a %s bot without creating a student account", async (color) => {
    game = fixture(color);
    const snapshot = await getLiveGame(student,gameId);
    expect(snapshot.players[color]?.name).toBe("Class Bot · BOT");
    expect(snapshot.players[color]?.botDifficultyId).toBe("knight");
    expect(snapshot.players[color]?.portrait).toContain("zippy-knight");
    expect(snapshot.viewer.color).not.toBe(color);
    expect((await getTeacherLiveGame(gameId)).players[color]?.id).toBe(botId);
    await expect(getLiveGame(botId,gameId)).rejects.toThrow("not a player");
  });

  it("accepts the student's move immediately, then generates the bot reply using saved skill", async () => {
    const snapshot = await submitLiveMove(student,gameId,{ from:"e2",to:"e4",version:1,difficultyId:"queen" });
    expect(snapshot.moves).toHaveLength(1);
    expect(mocks.schedule).toHaveBeenCalledWith(gameId);
    await advanceArenaBotGame(gameId);
    expect(mocks.choose).toHaveBeenCalledWith(expect.any(String),"knight",{ moveHistory:["e2e4"] });
    expect(game.moves.map(m=>m.san)).toEqual(["e4","e5"]);
    expect(game.active_color).toBe("white");
    expect(game.black_player_id).toBeNull();
    expect(game.bot_lease_until).toBeNull();
  });

  it("plays the first move when the bot is White and never allows the student to move for it", async () => {
    game = fixture("white"); mocks.choose.mockResolvedValue("e2e4");
    await expect(submitLiveMove(student,gameId,{ from:"e2",to:"e4",version:1 })).rejects.toThrow("not your turn");
    await advanceArenaBotGame(gameId);
    expect(game.moves[0].san).toBe("e4");
    expect(game.active_color).toBe("black");
  });

  it("does not duplicate a reply when two callbacks run at once", async () => {
    game = { ...game, ...applyLiveMove(game,student,{from:"e2",to:"e4",version:1},Date.now()).update };
    await Promise.all([advanceArenaBotGame(gameId),advanceArenaBotGame(gameId)]);
    expect(mocks.choose).toHaveBeenCalledTimes(1);
    expect(game.moves).toHaveLength(2);
  });

  it("releases its lease after an engine failure so a reload can recover", async () => {
    game = fixture("white"); mocks.choose.mockRejectedValueOnce(new Error("engine unavailable"));
    await expect(advanceArenaBotGame(gameId)).rejects.toThrow("unavailable");
    expect(game.bot_lease_until).toBeNull();
    mocks.choose.mockResolvedValue("e2e4"); await advanceArenaBotGame(gameId);
    expect(game.moves).toHaveLength(1);
  });

  it.each(["white", "black"] as const)("persists only the human's result against a %s bot, with no rating update", async (color) => {
    game = fixture(color);
    await performLiveGameAction(student,gameId,{action:"resign",version:1});
    await getLiveGame(student,gameId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ player_id:student,opponent_type:"computer",opponent_id:"knight",result:"loss" });
    expect(game.pgn).toContain("Class Bot");
    expect(mocks.rating).not.toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledWith(gameId);
  });

  it("settles timeout without generating a late bot move", async () => {
    game = fixture("white"); game.white_ms=1; game.clock_started_at=new Date(Date.now()-1000).toISOString();
    await advanceArenaBotGame(gameId);
    expect(game.status).toBe("completed"); expect(game.result_reason).toBe("timeout");
    expect(game.winner_color).toBe("black"); expect(mocks.choose).not.toHaveBeenCalled();
    expect(history[0].result).toBe("win");
  });

  it("finishes checkmate through the normal history and Arena scoring path", async () => {
    game = fixture("white"); game.initial_fen="7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"; game.current_fen=game.initial_fen;
    mocks.choose.mockResolvedValue("f7g7"); await advanceArenaBotGame(gameId);
    expect(game.result_reason).toBe("checkmate"); expect(history[0].result).toBe("loss");
  });
});
