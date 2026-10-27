import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOnlinePlay } from "@/lib/onlinePlay/server";

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => db }));

describe("combined online state and ongoing-game reminders", () => {
  const queries: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const results: Record<string, { data: unknown[]; error: unknown }> = {};
  beforeEach(() => {
    vi.clearAllMocks();
    results.student_online_presence = { data: [{ student_id: "me" }, { student_id: "other" }], error: null };
    results.student_live_challenges = { data: [], error: null };
    results.live_chess_games = { data: [
      { id: "mine", white_player_id: "me", black_player_id: "offline", active_color: "black", arena_tournament_id: null },
      { id: "tournament", white_player_id: null, black_player_id: "me", active_color: "black", arena_tournament_id: "arena", arena_bot: { id: "bot", name: "Pumpkin", color: "white" } },
      { id: "private-other-game", white_player_id: "other", black_player_id: "stranger", active_color: "white", arena_tournament_id: null }
    ], error: null };
    results.students = { data: [{ id: "me", display_name: "Me" }, { id: "other", display_name: "Other" }, { id: "offline", display_name: "Offline opponent" }], error: null };
    db.from.mockImplementation(table => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const method of ["select", "eq", "gt", "or", "order", "limit", "in"]) query[method] = vi.fn(() => query);
      query.then = vi.fn(resolve => Promise.resolve(results[table]).then(resolve));
      queries[table] = query;
      return query;
    });
  });

  it("returns only the signed-in student's games, including offline opponents and tournament bots", async () => {
    const state = await getOnlinePlay("me");
    expect(state.activeGames).toEqual([
      { id: "mine", status: "active", gameMode: "live", viewerColor: "white", opponent: { id: "offline", name: "Offline opponent" }, activeColor: "black", arenaTournamentId: null },
      { id: "tournament", status: "active", gameMode: "live", viewerColor: "black", opponent: { id: "bot", name: "Pumpkin" }, activeColor: "black", arenaTournamentId: "arena" }
    ]);
    expect(JSON.stringify(state)).not.toContain("private-other-game");
    expect(state.busy).toBe(true);
    expect(state.students).toEqual([{ id: "other", name: "Other", busy: true }]);
    expect(queries.students.in).toHaveBeenCalledWith("id", expect.arrayContaining(["offline"]));
  });

  it("uses the same four reads and never loads histories, avatar catalogs or badges", async () => {
    await getOnlinePlay("me");
    expect(db.from.mock.calls.map(([table]) => table)).toEqual(["student_online_presence", "student_live_challenges", "live_chess_games", "students"]);
    expect(queries.live_chess_games.eq).toHaveBeenCalledWith("status", "active");
    expect(queries.live_chess_games.eq).toHaveBeenCalledWith("game_mode", "live");
    expect(queries.live_chess_games.select.mock.calls[0][0]).not.toMatch(/\*|moves|pgn|fen|realtime_token/);
  });

  it("clears reminders as soon as no active games remain", async () => {
    results.live_chess_games.data = [];
    expect(await getOnlinePlay("me")).toMatchObject({ activeGames: [], busy: false });
  });

  it("does not turn a failed database check into an empty game list", async () => {
    results.live_chess_games = { data: [], error: new Error("offline") };
    await expect(getOnlinePlay("me")).rejects.toThrow("Online students could not be loaded");
  });
});
