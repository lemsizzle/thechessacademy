import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  scans: [] as Array<{source_id:string; internal_game_id:string|null; payload:unknown}>,
  rpc: vi.fn(), reject: vi.fn(), fetchPending: vi.fn(), after: vi.fn(),
  game: { initial_fen: undefined, moves: [{from:"f2",to:"f3"},{from:"e7",to:"e5"},{from:"g2",to:"g4"},{from:"d8",to:"h4",clockAfterMs:100}], player_color:"black", winner_color:"black", result_reason:"checkmate", time_control:{incrementMs:0} }
}));
vi.mock("next/server", () => ({ after: state.after }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({
  rpc: state.rpc,
  from: (table: string) => {
    let rejecting = false;
    const query = {
      select: () => query, eq: () => query, order: () => query,
      update: (patch: unknown) => { rejecting=true; state.reject(patch); return query; },
      is: () => rejecting ? Promise.resolve({error:null}) : query,
      limit: () => { state.fetchPending(); return Promise.resolve({data:state.scans,error:null}); },
      single: () => Promise.resolve({data: table === "internal_chess_games" ? state.game : null,error:null})
    };
    return query;
  }
}) }));
import { processPendingGameAchievements, scheduleGameAchievements } from "@/lib/badges/gameAchievements/server";

beforeEach(() => {
  vi.clearAllMocks();
  state.rpc.mockResolvedValue({error:null});
  state.scans=[{source_id:"academy:game",internal_game_id:"game",payload:null}];
});
describe("durable achievement queue", () => {
  it("uses saved legal moves and server clocks to detect a finished game", async () => {
    await processPendingGameAchievements("student");
    expect(state.rpc).toHaveBeenCalledWith("complete_game_achievement_scan", expect.objectContaining({p_student_id:"student",p_source_id:"academy:game",p_hits:expect.arrayContaining([
      expect.objectContaining({key:"mate-move-2",ply:4}), expect.objectContaining({key:"tenth-second-mate",ply:4})
    ])}));
  });
  it("defers evaluation until after the game response", async () => {
    scheduleGameAchievements(["student","student"]);
    expect(state.fetchPending).not.toHaveBeenCalled();
    await state.after.mock.calls[0][0]();
    expect(state.fetchPending).toHaveBeenCalledTimes(1);
  });
  it("shares simultaneous drains within an instance", async () => {
    const first=processPendingGameAchievements("student");
    const second=processPendingGameAchievements("student");
    expect(first).toBe(second);
    await first;
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });
  it("leaves database failures retryable", async () => {
    state.rpc.mockResolvedValueOnce({error:{message:"temporary outage"}});
    await expect(processPendingGameAchievements("student")).rejects.toThrow("temporary outage");
    expect(state.reject).not.toHaveBeenCalled();
    await processPendingGameAchievements("student");
    expect(state.rpc).toHaveBeenCalledTimes(2);
  });
  it("rejects an invalid replay and continues with the next game", async () => {
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    state.scans.unshift({source_id:"lichess:badgame1",internal_game_id:null,payload:{moves:"e4 e4",color:"w",winner:"w",reason:"resign"}});
    try {
      await processPendingGameAchievements("student");
      expect(state.reject).toHaveBeenCalledWith(expect.objectContaining({won:false,payload:null,validation_error:"Invalid legal move history"}));
      expect(state.rpc).toHaveBeenCalledTimes(1);
      expect(state.rpc.mock.calls[0][1].p_source_id).toBe("academy:game");
    } finally { log.mockRestore(); }
  });
});
