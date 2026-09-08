import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), after: vi.fn(), rpc: vi.fn(), writes: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
import { matchInternalArenaStudent, updateInternalArenaStatus } from "@/chess/persistence/arenaServer";

const id = "11111111-1111-4111-8111-111111111111";
let arena: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  arena = { id, status: "active", starts_at: new Date().toISOString(), ends_at: new Date(Date.now()+3600000).toISOString(), pairings_paused: false };
  mocks.client.mockReturnValue({ rpc: mocks.rpc, from: (table: string) => {
    let updates: Record<string, unknown> | undefined;
    const query = {
      select: () => query, eq: () => query, in: () => query, gt: () => query, not: () => query, order: () => query, limit: () => query,
      update: (data: Record<string, unknown>) => { updates=data; mocks.writes(table,data); return query; },
      maybeSingle: async () => ({ data: updates && !["active","scheduled"].includes(String(arena.status)) ? null : { ...arena, ...updates }, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
    };
    return query;
  }});
});

it("pauses new pairings without ending entries or changing tournament time", async () => {
  const result = await updateInternalArenaStatus(id, "pause_pairings");
  expect(result.pairingsPaused).toBe(true);
  expect(mocks.writes).toHaveBeenCalledExactlyOnceWith("internal_arena_tournaments", { pairings_paused: true });
  expect(mocks.after).not.toHaveBeenCalled();
});

it("resumes and schedules matchmaking for the existing queue", async () => {
  arena.pairings_paused = true;
  expect((await updateInternalArenaStatus(id, "resume_pairings")).pairingsPaused).toBe(false);
  expect(mocks.after).toHaveBeenCalledOnce();
});

it("rejects pairing changes after tournament completion", async () => {
  arena.status = "finished";
  await expect(updateInternalArenaStatus(id, "resume_pairings")).rejects.toThrow("no longer accepting");
});

it("keeps students waiting when the database blocks a paused pairing, without falling through to bots", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "Arena pairings are paused by the teacher." } });
  expect(await matchInternalArenaStudent(id,id)).toEqual({ status: "waiting", gameId: null });
  expect(mocks.rpc).toHaveBeenCalledOnce();
  expect(mocks.after).not.toHaveBeenCalled();
});
