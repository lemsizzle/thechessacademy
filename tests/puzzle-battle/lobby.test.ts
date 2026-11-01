import { beforeEach, expect, it, vi } from "vitest";
import { newBattlePlayer } from "@/lib/puzzle-battle/rules";
import type { BattleRecord } from "@/lib/puzzle-battle/types";
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from }) }));
import { listBattles } from "@/lib/puzzle-battle/server";

function room(id: string): BattleRecord {
  return {
    id, code: id, host_id: "host", guest_id: null, mode: "survival", duration: 60,
    version: 0, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(),
    realtime_token: "test", state: { status: "waiting", players: [newBattlePlayer("host", "Host")],
      startsAt: null, endsAt: null, winnerId: null },
  };
}
beforeEach(() => from.mockReset());
it("lists only unexpired open seats and avoids loading personal history", async () => {
  const open = room("open"), expired = room("expired"), full = room("full"),
    playing = room("playing"), finished = room("finished"), cancelled = room("cancelled"),
    reserved = room("reserved"), invited = room("invited");
  expired.expires_at = new Date(Date.now() - 1000).toISOString();
  full.guest_id = "guest";
  playing.state.status = "playing";
  finished.state.status = "finished";
  cancelled.state.status = "cancelled";
  reserved.state.invitedId = "someone-else";
  invited.state.invitedId = "me";
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), gt: vi.fn(), order: vi.fn(), limit: vi.fn() };
  for (const name of ["select", "eq", "is", "gt", "order"] as const) query[name].mockReturnValue(query);
  query.limit.mockResolvedValue({ data: [open, expired, full, playing, finished, cancelled, reserved, invited], error: null });
  from.mockReturnValue(query);
  expect((await listBattles("me")).map(r => r.id)).toEqual(["open", "invited"]);
  expect(from).toHaveBeenCalledTimes(1);
  expect(query.eq).toHaveBeenCalledWith("state->>status", "waiting");
  expect(query.is).toHaveBeenCalledWith("guest_id", null);
  expect(query.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
});
