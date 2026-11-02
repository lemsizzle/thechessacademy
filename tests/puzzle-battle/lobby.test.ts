import { beforeEach, expect, it, vi } from "vitest";
import { newBattlePlayer } from "@/lib/puzzle-battle/rules";
import type { BattleRecord } from "@/lib/puzzle-battle/types";
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from }) }));
import { battleLobby, listBattles } from "@/lib/puzzle-battle/server";

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

it("exposes an unfinished personal battle separately from open challenges", async () => {
  const own = room("my-bot"), open = room("open"), expired = room("expired");
  own.host_id = "me";
  own.state = { ...own.state, status: "playing", startsAt: Date.now()-1000,
    endsAt: Date.now()+60000, players: [newBattlePlayer("me", "Me"), newBattlePlayer("bot:gentle", "Gentle Bot")] };
  expired.expires_at = new Date(Date.now()-1000).toISOString();
  const query = { select: vi.fn(), or: vi.fn(), in: vi.fn(), eq: vi.fn(), is: vi.fn(), gt: vi.fn(), order: vi.fn(), limit: vi.fn() };
  for (const name of ["select","or","in","eq","is","gt","order"] as const) query[name].mockReturnValue(query);
  query.limit.mockResolvedValueOnce({data:[own],error:null}).mockResolvedValueOnce({data:[open,expired],error:null});
  from.mockReturnValue(query);
  const result = await battleLobby("me");
  expect(result.battles.map(item=>item.id)).toEqual(["open"]);
  expect(result.currentBattle?.id).toBe("my-bot");
  expect(query.in).toHaveBeenCalledWith("state->>status", ["waiting","playing"]);
});

it("does not offer expired personal rooms as a blocker", async () => {
  const expired = room("expired");
  expired.host_id="me"; expired.state.players=[newBattlePlayer("me","Me")];
  expired.expires_at=new Date(Date.now()-1000).toISOString();
  const query = {select:vi.fn(),or:vi.fn(),in:vi.fn(),eq:vi.fn(),is:vi.fn(),gt:vi.fn(),order:vi.fn(),limit:vi.fn()};
  for (const name of ["select","or","in","eq","is","gt","order"] as const) query[name].mockReturnValue(query);
  query.limit.mockResolvedValue({data:[expired],error:null});from.mockReturnValue(query);
  expect(await battleLobby("me")).toEqual({battles:[],currentBattle:null});
});
