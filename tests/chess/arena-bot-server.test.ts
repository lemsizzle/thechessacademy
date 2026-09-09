import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import type { LiveGameRecord } from "@/chess/live/types";
import { applyLiveMove } from "@/chess/live/rules";
import { arenaBotThinkingRemainingMs } from "@/chess/arena/botThinking";
import { arenaBotAvatar } from "@/chess/arena/lobbyAvatars";

const mocks = vi.hoisted(() => ({ client: vi.fn(), choose: vi.fn(), finalize: vi.fn(), schedule: vi.fn(), rating: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({ getStudentAvatarDisplayData: async () => ({ avatars: {}, items: [
  { id: "store-shirt", category: "clothing", assetUrl: "/shirt.png", isActive: true },
  { id: "store-hair", category: "hair", assetUrl: "/hair.png", isActive: true }
] }) }));
vi.mock("@/chess/engine/arenaStockfishServer", () => ({ chooseArenaBotMove: mocks.choose }));
vi.mock("@/chess/persistence/arenaServer", () => ({ finalizeInternalArenaGame: mocks.finalize, scheduleArenaBotTurn: mocks.schedule }));
vi.mock("@/chess/persistence/ratingServer", () => ({ applyRatingForCompletedGame: mocks.rating }));
import { advanceArenaBotGame as scheduleBotMove, getLiveGame, getTeacherLiveGame, performLiveGameAction, submitLiveMove } from "@/chess/persistence/liveGameServer";

async function advanceArenaBotGame(id: string) {
  const outcome = scheduleBotMove(id).then(() => ({ error: null }), (error: unknown) => ({ error }));
  await vi.runAllTimersAsync();
  const result = await outcome;
  if (result.error) throw result.error;
}

const student = "11111111-1111-4111-8111-111111111111";
const botId = "22222222-2222-4222-8222-222222222222";
const gameId = "33333333-3333-4333-8333-333333333333";
let game: LiveGameRecord;
let otherGames: LiveGameRecord[];
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
    let rows: Record<string, unknown>[] = table === "live_chess_games" ? [game, ...otherGames] : table === "students" ? [{ id: student, display_name: "Learner", lichess_username: null }] : history;
    rows = rows.filter(row => filters.every(filter => filter(row)));
    if (update && rows.length && table === "live_chess_games") {
      rows = rows.map(row => ({ ...row, ...update }));
      for (const row of rows) {
        if (row.id === game.id) game = row as LiveGameRecord;
        else otherGames = otherGames.map(other => other.id === row.id ? row as LiveGameRecord : other);
      }
    }
    if (insert && table === "internal_chess_games") { history.push(...insert); rows = insert; }
    return { data: rows, error: null };
  }
  return api;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks(); game = fixture(); otherGames = []; history = [];
  mocks.client.mockReturnValue({ from: query, rpc: async (_name: string, args: { p_game_id: string }) => {
    const row = [game, ...otherGames].find(candidate => candidate.id === args.p_game_id)!;
    if (row.status !== "active" || row.bot_lease_until) return { data: [], error: null };
    const claimed = { ...row, bot_lease_until: new Date(Date.now()+15000).toISOString() };
    if (row.id === game.id) game = claimed;
    else otherGames = otherGames.map(other => other.id === row.id ? claimed : other);
    return { data: [structuredClone(claimed)], error: null };
  } });
  mocks.choose.mockResolvedValue("e7e5");
});
afterEach(() => vi.useRealTimers());

describe("Arena thinking cadence", () => {
  it("does not let two thinking bots block a third game's ready engine job", async () => {
    game = fixture("white");
    const second = { ...fixture("white"), id: "66666666-6666-4666-8666-666666666666" };
    const ready = { ...fixture("white"), id: "77777777-7777-4777-8777-777777777777",
      clock_started_at: new Date(Date.now() - 45000).toISOString() };
    otherGames = [second, ready];
    mocks.choose.mockResolvedValue("e2e4");
    const pending = [scheduleBotMove(gameId), scheduleBotMove(second.id), scheduleBotMove(ready.id)];
    await vi.advanceTimersByTimeAsync(0);
    await pending[2];
    expect(mocks.choose).toHaveBeenCalledTimes(1);
    expect(game.moves).toHaveLength(0);
    expect(otherGames[0].moves).toHaveLength(0);
    expect(otherGames[1].moves).toHaveLength(1);
    await vi.runAllTimersAsync();
    await Promise.all(pending);
    expect(mocks.choose).toHaveBeenCalledTimes(3);
  });

  it("wakes at flag fall rather than playing a late move", async () => {
    game = fixture("white");
    game.white_ms = 100;
    const pending = scheduleBotMove(gameId);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(game.result_reason).toBe("timeout");
    expect(mocks.choose).not.toHaveBeenCalled();
  });

  it("waits before every reply without taking a lease, and polling does not restart the wait", async () => {
    await submitLiveMove(student, gameId, { from: "e2", to: "e4", version: 1 });
    const delay = arenaBotThinkingRemainingMs(game, Date.now());
    const first = scheduleBotMove(gameId);
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(mocks.choose).not.toHaveBeenCalled();
    expect(game.bot_lease_until).toBeUndefined();
    expect(scheduleBotMove(gameId)).toBe(first);
    await vi.advanceTimersByTimeAsync(1);
    await first;
    expect(game.moves).toHaveLength(2);
    expect(game.black_ms).toBe(600000 - delay);

    await submitLiveMove(student, gameId, { from: "g1", to: "f3", version: game.version });
    mocks.choose.mockResolvedValue("b8c6");
    const secondDelay = arenaBotThinkingRemainingMs(game, Date.now());
    const second = scheduleBotMove(gameId);
    await vi.advanceTimersByTimeAsync(secondDelay - 1);
    expect(mocks.choose).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(game.moves).toHaveLength(4);
    expect(secondDelay).not.toBe(delay);
  });

  it("does not move after the student resigns during the wait", async () => {
    game = fixture("white");
    const pending = scheduleBotMove(gameId);
    await vi.advanceTimersByTimeAsync(1);
    await performLiveGameAction(student, gameId, { action: "resign", version: 1 });
    await vi.runAllTimersAsync();
    await pending;
    expect(mocks.choose).not.toHaveBeenCalled();
    expect(game.moves).toHaveLength(0);
  });

  it("does not skip the next bot's wait when another server has already moved", async () => {
    game = fixture("white");
    game.arena_opponent_bot = { id: "55555555-5555-4555-8555-555555555555", name: "Luna", color: "black", difficultyId: "queen" };
    const pending = scheduleBotMove(gameId);
    await vi.advanceTimersByTimeAsync(1);
    const engineGame = { ...game, white_player_id: botId };
    game = { ...game, ...applyLiveMove(engineGame, botId, { from: "e2", to: "e4", version: 1 }, Date.now()).update };
    await vi.runAllTimersAsync();
    await pending;
    expect(mocks.choose).not.toHaveBeenCalled();
    expect(game.moves).toHaveLength(1);
    expect(game.bot_lease_until).toBeNull();
  });
});

it("persists Berserk through the authenticated action and exposes it in both snapshots", async () => {
  game.time_control.incrementMs = 3_000;
  const snapshot = await performLiveGameAction(student, gameId, { action: "berserk", version: 1 });
  expect(game.white_berserk).toBe(true);
  expect(game.white_ms).toBeLessThanOrEqual(300_000);
  expect(snapshot.berserk).toEqual({ white: true, black: false });
  expect((await getTeacherLiveGame(gameId)).berserk).toEqual({ white: true, black: false });
  await expect(performLiveGameAction(student, gameId, { action: "berserk", version: 1 })).rejects.toThrow("changed");
  await expect(performLiveGameAction(botId, gameId, { action: "berserk", version: game.version })).rejects.toThrow("not a player");
});

describe("authoritative Arena bot game flow", () => {
  it.each(["white", "black"] as const)("shows a %s bot without creating a student account", async (color) => {
    game = fixture(color);
    const snapshot = await getLiveGame(student,gameId);
    expect(snapshot.players[color]?.name).toBe("Class Bot");
    expect(snapshot.players[color]?.botDifficultyId).toBe("knight");
    expect(snapshot.players[color]?.portrait).toContain("zippy-knight");
    expect(snapshot.players[color]?.avatar).toEqual(arenaBotAvatar(game.arena_tournament_id!, botId, snapshot.avatarItems));
    expect(snapshot.players[color]?.avatar?.equippedItems.clothing).toBe("store-shirt");
    expect(snapshot.avatarItems.map(item => item.id)).toContain("store-hair");
    expect((await getTeacherLiveGame(gameId)).players[color]?.avatar).toEqual(snapshot.players[color]?.avatar);
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

  it("uses the saved custom strength and ignores a student's submitted override", async () => {
    game.arena_bot!.difficultyId = "arena-875";
    await submitLiveMove(student,gameId,{ from:"e2",to:"e4",version:1,difficultyId:"arena-375" });
    await advanceArenaBotGame(gameId);
    expect(mocks.choose).toHaveBeenCalledWith(expect.any(String),"arena-875",{ moveHistory:["e2e4"] });
    expect((await getTeacherLiveGame(gameId)).players.black?.botDifficultyId).toBe("arena-875");
    expect((await getTeacherLiveGame(gameId)).players.black?.portrait).toBeTruthy();
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

describe("bot-versus-bot Arena games", () => {
  beforeEach(() => {
    game = {
      ...fixture("white"), created_by: null, white_player_id: null, black_player_id: null,
      arena_opponent_bot: { id: "55555555-5555-4555-8555-555555555555", color: "black", name: "Luna", difficultyId: "queen" }
    };
    mocks.choose.mockImplementation(async (fen: string) => {
      const move = new Chess(fen).moves({ verbose: true })[0];
      return `${move.from}${move.to}${move.promotion ?? ""}`;
    });
  });

  it("shows both nicknames and both skill presets on the spectator board", async () => {
    const snapshot = await getTeacherLiveGame(gameId);
    expect(snapshot.players.white).toMatchObject({ id: botId, name: "Class Bot", botDifficultyId: "knight" });
    expect(snapshot.players.black).toMatchObject({ name: "Luna", botDifficultyId: "queen" });
    await expect(getLiveGame(student,gameId)).rejects.toThrow("not a player");
    await expect(submitLiveMove(student,gameId,{from:"e2",to:"e4",version:1})).rejects.toThrow("not a player");
  });

  it("plays one paced turn at a time, alternating saved skills without duplicate workers", async () => {
    await Promise.all([advanceArenaBotGame(gameId),advanceArenaBotGame(gameId)]);
    expect(game.moves).toHaveLength(1);
    expect(mocks.choose.mock.calls.map(call=>call[1])).toEqual(["knight"]);
    expect(game.white_player_id).toBeNull(); expect(game.black_player_id).toBeNull();
    expect(game.bot_lease_until).toBeNull();
    await advanceArenaBotGame(gameId);
    expect(game.moves).toHaveLength(2);
    expect(mocks.choose.mock.calls.map(call=>call[1])).toEqual(["knight", "queen"]);
  });

  it("honors different custom strengths for both bots", async () => {
    game.arena_bot!.difficultyId = "arena-650";
    game.arena_opponent_bot!.difficultyId = "arena-1450";
    await advanceArenaBotGame(gameId);
    await advanceArenaBotGame(gameId);
    expect(mocks.choose.mock.calls.map(call=>call[1])).toEqual(["arena-650","arena-1450"]);
  });

  it.each(["white","black"] as const)("scores a %s checkmate without student history or rating writes", async (color) => {
    game.initial_fen = color === "white" ? "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1" : "8/8/8/8/8/6k1/5q2/7K b - - 0 1";
    game.current_fen = game.initial_fen; game.active_color = color;
    mocks.choose.mockResolvedValue(color === "white" ? "f7g7" : "f2g2");
    await advanceArenaBotGame(gameId);
    expect(game.result_reason).toBe("checkmate"); expect(game.winner_color).toBe(color);
    expect(mocks.choose).toHaveBeenCalledTimes(1);
    expect(mocks.finalize).toHaveBeenCalledWith(gameId);
    expect(history).toEqual([]); expect(mocks.rating).not.toHaveBeenCalled();
    expect(game.pgn).toContain('[White "Class Bot"]'); expect(game.pgn).toContain('[Black "Luna"]');
  });

  it("settles either bot's timeout without a late engine move or student rewards", async () => {
    game.active_color="black"; game.black_ms=1; game.clock_started_at=new Date(Date.now()-1000).toISOString();
    await advanceArenaBotGame(gameId);
    expect(game.status).toBe("completed"); expect(game.winner_color).toBe("white");
    expect(mocks.choose).not.toHaveBeenCalled(); expect(history).toEqual([]);
    expect(mocks.rating).not.toHaveBeenCalled(); expect(mocks.finalize).toHaveBeenCalledWith(gameId);
  });

  it("recovers interrupted final scoring without playing the final move twice", async () => {
    game.initial_fen="7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"; game.current_fen=game.initial_fen;
    mocks.choose.mockResolvedValue("f7g7");
    mocks.finalize.mockRejectedValueOnce(new Error("temporary scoring failure"));
    await expect(advanceArenaBotGame(gameId)).rejects.toThrow("temporary scoring failure");
    expect(game.status).toBe("completed");
    await advanceArenaBotGame(gameId);
    expect(mocks.finalize).toHaveBeenCalledTimes(2);
    expect(mocks.choose).toHaveBeenCalledTimes(1); expect(history).toEqual([]);
  });
});
