import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), writes: vi.fn(), conflict: false }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
import { updateInternalArenaSchedule } from "@/chess/persistence/arenaServer";
const id = "11111111-1111-4111-8111-111111111111";
let arena: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks(); mocks.conflict = false;
  arena = { id, status: "scheduled", starts_at: new Date(Date.now()+3600000).toISOString(), ends_at: new Date(Date.now()+7200000).toISOString(), duration_minutes: 60 };
  mocks.client.mockReturnValue({ from: (table: string) => {
    let update: Record<string, unknown> | undefined;
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
      update: (value: Record<string, unknown>) => { update = value; mocks.writes(table,value); return query; },
      maybeSingle: async () => ({ data: update && mocks.conflict ? null : { ...arena, ...update }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({data: [],error: null}).then(resolve)
    }; return query;
  }});
});
it("reschedules a published tournament and recomputes its end without touching games or entries", async () => {
  const startsAt = new Date(Date.now()+86400000).toISOString();
  const result = await updateInternalArenaSchedule(id,{ startsAt, durationMinutes: 90 });
  expect(result.startsAt).toBe(startsAt);
  expect(result.endsAt).toBe(new Date(Date.parse(startsAt)+5400000).toISOString());
  expect(mocks.writes).toHaveBeenCalledExactlyOnceWith("internal_arena_tournaments",expect.objectContaining({status:"scheduled",duration_minutes:90}));
});
it("extends a running tournament while preserving its actual start", async () => {
  arena.status = "active"; arena.starts_at = new Date(Date.now()-600000).toISOString();
  const result = await updateInternalArenaSchedule(id,{durationMinutes:120});
  expect(result.startsAt).toBe(arena.starts_at); expect(result.durationMinutes).toBe(120);
});
it.each([0,9,241,10.5,"60",null])("rejects invalid durations: %s", async durationMinutes => {
  await expect(updateInternalArenaSchedule(id,{durationMinutes})).rejects.toThrow("between 10 and 240");
  expect(mocks.writes).not.toHaveBeenCalled();
});
it.each(["invalid","2026-09-20T12:00",""])("rejects invalid or timezone-free start times",async startsAt=>{
  await expect(updateInternalArenaSchedule(id,{startsAt,durationMinutes:60})).rejects.toThrow("valid start time");
});
it("rejects changing the start after play has begun",async()=>{
  arena.status="active";
  await expect(updateInternalArenaSchedule(id,{startsAt:new Date(Date.now()+86400000).toISOString(),durationMinutes:60})).rejects.toThrow("has started");
});
it.each(["finished","cancelled"])("does not reopen a %s tournament",async status=>{
  arena.status=status;
  await expect(updateInternalArenaSchedule(id,{durationMinutes:60})).rejects.toThrow("cannot be rescheduled");
});
it("rejects shortening past elapsed time",async()=>{
  arena.status="active"; arena.starts_at=new Date(Date.now()-3600000).toISOString();
  await expect(updateInternalArenaSchedule(id,{durationMinutes:10})).rejects.toThrow("end time must be in the future");
});
it("does not overwrite a concurrent finish or schedule update",async()=>{
  mocks.conflict=true;
  await expect(updateInternalArenaSchedule(id,{durationMinutes:90})).rejects.toThrow("changed while saving");
});
