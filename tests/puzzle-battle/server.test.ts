import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import type { BattleRecord, BattleChallenge, BattleAction } from "@/lib/puzzle-battle/types";
import type { StudentSession } from "@/lib/types";
import { newBattlePlayer } from "@/lib/puzzle-battle/rules";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ rpc }) }));
const id = "10000000-0000-4000-8000-000000000001";
const student = { id: "20000000-0000-4000-8000-000000000001", name: "A" };
const session = { studentId: student.id, authProvider: "academy", academyUsername: "a" } as StudentSession;
const deck: BattleChallenge[] = [{ kind: "survival", puzzle: {
  id: "puzzle", initial_fen: new Chess().fen(), start_mode: "direct",
  moves: ["e2e4", "a7a6", "e4e5", "b7b6", "e5e6"], accepted_moves: [],
  themes: [], rating: 500, game_url: null,
} }];
let record: BattleRecord;
let active: boolean;
let act: typeof import("@/lib/puzzle-battle/server").actOnBattle;
const action = (revision: number, from = "e2", to = "e4"): BattleAction => ({
  type: "move", actionId: crypto.randomUUID(), revision, move: { from, to },
});
beforeEach(async () => {
  vi.resetModules(); rpc.mockReset(); active = true;
  record = {
    id, code: "12345678", host_id: student.id, guest_id: "b", mode: "survival", duration: 60,
    version: 0, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600000).toISOString(),
    realtime_token: "private", state: { status: "playing", startsAt: Date.now() - 1000, endsAt: Date.now() + 60000,
      winnerId: null, players: [newBattlePlayer(student.id, "A"), newBattlePlayer("b", "B")],
    },
  };
  rpc.mockImplementation(async (name, args) => {
    if (!active) return { data: null, error: { code: "28000" } };
    if (name === "load_puzzle_battle") return { data: structuredClone({ record, deck }), error: null };
    expect(name).toBe("submit_puzzle_battle_player");
    expect(args.p_identity).toEqual({ provider: "academy", username: "a" });
    if (record.state.status !== "playing") return { data: structuredClone(record), error: null };
    if (args.p_revision !== record.state.players[0].revision) return { data: null, error: null };
    record.state.players[0] = structuredClone(args.p_player);
    record.version++;
    return { data: structuredClone(record), error: null };
  });
  act = (await import("@/lib/puzzle-battle/server")).actOnBattle;
});
describe("cached battle answers", () => {
  it("uses one authenticated database round trip for continuation after a cold first answer", async () => {
    await act(id, student, action(0), session);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["load_puzzle_battle", "submit_puzzle_battle_player"]);
    rpc.mockClear();
    const next = await act(id, student, action(1, "e4", "e5"), session);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["submit_puzzle_battle_player"]);
    expect(next.state.players[0].moveIndex).toBe(4);
    expect(next.state.players[0].score).toBe(0);
  });
  it("rechecks revoked access on a warm cached position", async () => {
    await act(id, student, action(0), session);
    active = false;
    await expect(act(id, student, action(1, "e4", "e5"), session)).rejects.toThrow(/login/);
    expect(record.state.players[0].revision).toBe(1);
  });
  it("reconciles another instance accepting the same action without applying it twice", async () => {
    await act(id, student, action(0), session);
    const second = action(1, "e4", "e5");
    record.state.players[0] = { ...record.state.players[0], revision: 2, moveIndex: 4, lastAction: second.actionId };
    record.version++;
    rpc.mockClear();
    const result = await act(id, student, second, session);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["submit_puzzle_battle_player", "load_puzzle_battle"]);
    expect(result.state.players[0].revision).toBe(2);
  });
  it("does not overwrite a forfeited match with a cached answer", async () => {
    await act(id, student, action(0), session);
    record.state.status = "finished";
    record.state.winnerId = student.id;
    record.version++;
    const result = await act(id, student, action(1, "e4", "e5"), session);
    expect(result.state.status).toBe("finished");
    expect(result.state.players[0].revision).toBe(1);
  });
  it("reloads before handling an old browser revision", async () => {
    await act(id, student, action(0), session);
    rpc.mockClear();
    await act(id, student, action(0), session);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["load_puzzle_battle"]);
    expect(record.state.players[0].revision).toBe(1);
  });
});
