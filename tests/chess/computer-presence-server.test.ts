import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), avatars: vi.fn(), presence: [] as unknown[], students: [] as unknown[], live: [] as unknown[], badges: [] as unknown[], queries: [] as Array<{ table: string; method: string; args: unknown[] }> }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({ getStudentAvatarDisplayData: mocks.avatars }));
vi.mock("@/chess/persistence/arenaServer", () => ({ finalizeInternalArenaGame: vi.fn(), scheduleArenaBotTurn: vi.fn() }));
import { getTeacherComputerGame, listTeacherComputerGames, publishComputerGamePresence } from "@/chess/persistence/computerGamePresenceServer";
import { listTeacherLiveGames, getTeacherLiveGame } from "@/chess/persistence/liveGameServer";
const gameId = "56be1301-448a-4f10-b211-de23b8387bf5";
const now = Date.parse("2026-10-08T02:00:00Z");
function row() { return {
  student_id: "student", game_id: gameId, version: 4, status: "active", bot_id: "pawny", human_color: "black", time_control_id: "5+3", move_count: 2,
  started_at: new Date(now - 60_000).toISOString(), updated_at: new Date(now - 500).toISOString(),
  snapshot: { moves: ["e2e4", "e7e5"], clock: { whiteMs: 290000, blackMs: 295000 }, winnerColor: null, resultReason: null }
}; }
beforeEach(() => {
  vi.clearAllMocks(); vi.spyOn(Date, "now").mockReturnValue(now);
  mocks.presence = [row()]; mocks.students = [{ id: "student", display_name: "Explorer", lichess_username: null }]; mocks.live = []; mocks.badges = []; mocks.queries = [];
  mocks.avatars.mockResolvedValue({ avatars: { student: { studentId: "student", equippedItems: { hat: "hat" } } }, items: [{ id: "hat" }, { id: "unused" }] });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.from.mockImplementation((table: string) => {
    let rows = table === "students" ? mocks.students : table === "student_badges" ? mocks.badges : table === "live_chess_games" ? mocks.live : mocks.presence;
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "order", "in"]) query[method] = (...args: unknown[]) => {
      mocks.queries.push({ table, method, args });
      if (method === "eq") rows = rows.filter((row) => (row as Record<string, unknown>)[args[0] as string] === args[1] || (table === "students" && args[0] === "is_active"));
      if (method === "gte") rows = rows.filter((row) => (row as Record<string, string>)[args[0] as string] >= (args[1] as string));
      return query;
    };
    query.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    query.then = (resolve: (value: unknown) => void) => Promise.resolve({ data: rows, error: null }).then(resolve);
    return query;
  });
});
afterEach(() => vi.restoreAllMocks());
describe("teacher computer-game discovery and watching", () => {
  it("shows the selected earned badge in human and computer game name tags", async () => {
    mocks.badges = [{ student_id: "student", is_displayed: true, badges: { id: "selected-badge", name: "Survival Adamantium", category: "Tactics", tier: "SS", final_image_url: "/badges/survival-adamantium-v1.webp", art_image_url: null } }];
    mocks.students.push({ id: "second", display_name: "Second Student", lichess_username: null });
    mocks.live = [{ id: "human-game", white_player_id: "student", black_player_id: "second", status: "active", game_mode: "live", started_at: row().started_at, updated_at: row().started_at, moves: [], active_color: "white", rated: true, matchmaking: true, arena_tournament_id: null, time_control: { id: "5+3", name: "5 + 3", initialMs: 300000, incrementMs: 3000 } }];
    const games = await listTeacherLiveGames();
    expect(games.find(game => game.id === "human-game")?.players.white.displayedBadge).toMatchObject({ id: "selected-badge", tier: "Adamantium" });
    const computer = await getTeacherComputerGame(`computer-${gameId}`);
    expect(computer.players.black.displayedBadge?.id).toBe("selected-badge");
    expect(computer.players.white.displayedBadge).toBeUndefined();
  });
  it("keeps gameplay available if decorative badge storage cannot be read", async () => {
    const from = mocks.from.getMockImplementation()!;
    mocks.from.mockImplementation((table: string) => {
      if (table === "student_badges") throw new Error("Temporary badge outage");
      return from(table);
    });
    expect((await getTeacherComputerGame(`computer-${gameId}`)).players.black.name).toBe("Explorer");
  });
  it("keeps student matches alongside computer practice in the teacher lobby and routes bot watch links correctly", async () => {
    mocks.students.push({ id: "second", display_name: "Second Student", lichess_username: null });
    mocks.live = [{ id: "human-game", white_player_id: "student", black_player_id: "second", status: "active", game_mode: "live", started_at: row().started_at, updated_at: row().started_at, moves: [], active_color: "white", rated: true, matchmaking: true, arena_tournament_id: null, time_control: { id: "5+3", name: "5 + 3", initialMs: 300000, incrementMs: 3000 } }];
    const games = await listTeacherLiveGames();
    expect(games.map((game) => game.id)).toEqual([`computer-${gameId}`, "human-game"]);
    expect(games[1]).toMatchObject({ rated: true, matchmaking: true, players: { white: { name: "Explorer" }, black: { name: "Second Student" } } });
    expect((await getTeacherLiveGame(`computer-${gameId}`)).computerPractice).toBe(true);
  });
  it("lists active practice with canonical bot names and student colors, excluding stale and completed sessions", async () => {
    mocks.presence.push({ ...row(), game_id: "stale", updated_at: new Date(now - 121000).toISOString() }, { ...row(), game_id: "done", status: "completed" });
    const games = await listTeacherComputerGames();
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ id: `computer-${gameId}`, computerPractice: true, players: { white: { name: "Pawny", botDifficultyId: "pawny" }, black: { name: "Explorer" } }, activeColor: "white", moveCount: 1 });
    expect(mocks.queries.find((query) => query.table === "student_computer_game_presence" && query.method === "select")?.args[0]).not.toContain("snapshot");
    expect(mocks.avatars).not.toHaveBeenCalled();
  });
  it("reconstructs legal replay positions, provides clocks, and sends only equipped avatar items", async () => {
    const game = await getTeacherComputerGame(`computer-${gameId}`);
    const chess = new Chess(); chess.move("e4"); chess.move("e5");
    expect(game.fen).toBe(chess.fen()); expect(game.moves.map((move) => move.san)).toEqual(["e4", "e5"]);
    expect(game.clocks).toEqual({ whiteMs: 290000, blackMs: 295000, startedAt: row().updated_at });
    expect(game.players.black.avatar).toBeDefined(); expect(game.avatarItems).toEqual([{ id: "hat" }]);
    expect(game.realtimeTopic).toBe("");
  });
  it.each(["closed", "expired", "completed"])("preserves the last board and stops live watching after %s", async (status) => {
    mocks.presence = [{ ...row(), status: status === "expired" ? "active" : status, updated_at: new Date(now - 121000).toISOString(), snapshot: { ...row().snapshot, resultReason: status === "completed" ? "resignation" : null, winnerColor: status === "completed" ? "white" : null } }];
    const game = await getTeacherComputerGame(`computer-${gameId}`);
    expect(game.status).toBe(status === "completed" ? "completed" : "cancelled"); expect(game.clocks.startedAt).toBeNull(); expect(game.moves).toHaveLength(2);
  });
  it("handles takebacks and rejected illegal positions without affecting play", async () => {
    mocks.presence = [{ ...row(), move_count: 0, snapshot: { ...row().snapshot, moves: [] } }];
    expect((await getTeacherComputerGame(`computer-${gameId}`)).fen).toBe(new Chess().fen());
    mocks.presence = [{ ...row(), snapshot: { ...row().snapshot, moves: ["e2e5"] } }];
    await expect(getTeacherComputerGame(`computer-${gameId}`)).rejects.toMatchObject({ status: 409 });
  });
  it("adjusts a sampled active clock for delivery time and delegates atomic ordering to the private RPC", async () => {
    await publishComputerGamePresence("verified-student", { gameId, version: 3, status: "active", botId: "pawny", humanColor: "black", timeControlId: "5+3", moves: ["e2e4"], startedAt: row().started_at, clock: { whiteMs: 299000, blackMs: 300000 }, capturedAt: new Date(now - 500).toISOString(), winnerColor: null, resultReason: null });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_student_computer_game", expect.objectContaining({ p_student_id: "verified-student", p_version: 3, p_snapshot: { moves: ["e2e4"], clock: { whiteMs: 299000, blackMs: 299500 }, winnerColor: null, resultReason: null } }));
  });
});
