import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn(), after: vi.fn(), advance: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({ getStudentAvatarDisplayData: async () => ({ avatars: {}, items: [] }) }));
vi.mock("@/chess/persistence/liveGameServer", () => ({ advanceArenaBotGame: mocks.advance }));
import { forceInternalArenaPair, getTeacherInternalArenaLobby, manageInternalArenaBot } from "@/chess/persistence/arenaServer";

const arenaId = "11111111-1111-4111-8111-111111111111";
const alpha = "22222222-2222-4222-8222-222222222222";
const beta = "33333333-3333-4333-8333-333333333333";
const human = "44444444-4444-4444-8444-444444444444";
const gameId = "55555555-5555-4555-8555-555555555555";
let tables: Record<string, Record<string, unknown>[]>;
function from(table: string) {
  const predicates: Array<(row: Record<string, unknown>) => boolean> = [];
  let updating = false;
  const result = () => ({ data: updating ? [] : (tables[table] ?? []).filter(row=>predicates.every(p=>p(row))), error: null });
  const query = {
    select: () => query, order: () => query, limit: () => query,
    eq: (key: string,value: unknown) => { predicates.push(row=>row[key]===value); return query; },
    in: (key: string,values: unknown[]) => { predicates.push(row=>values.includes(row[key])); return query; },
    not: (key: string,_op: string,value: unknown) => { predicates.push(row=>row[key]!==value); return query; },
    lte: () => query, gt: () => query,
    update: () => { updating = true; return query; },
    maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
    then: (resolve: (value: unknown)=>unknown) => Promise.resolve(result()).then(resolve)
  };
  return query;
}
beforeEach(() => {
  vi.clearAllMocks();
  const now = new Date().toISOString();
  tables = {
    internal_arena_tournaments: [{ id:arenaId, name:"Class Arena", status:"active", starts_at:now, ends_at:new Date(Date.now()+3600000).toISOString(), class_group:null, time_control_id:"10m", time_control:{id:"10m",initialMs:600000,incrementMs:0}, rated:false }],
    internal_arena_bots: [{id:alpha,tournament_id:arenaId,name:"Nova",difficulty_id:"knight",removed_at:null},{id:beta,tournament_id:arenaId,name:"Luna",difficulty_id:"queen",removed_at:null}],
    internal_arena_entries: [alpha,beta].map(id=>({tournament_id:arenaId,student_id:null,bot_id:id,status:"waiting",score:0,games_played:0,wins:0,draws:0,losses:0,current_game_id:null})),
    internal_arena_pairings: [], students: []
  };
  mocks.client.mockReturnValue({ from, rpc:mocks.rpc });
  mocks.rpc.mockResolvedValue({data:{status:"matched",gameId},error:null});
});

describe("Arena computer-player management", () => {
  it("force-pairs two bots through the server-only bot-pair RPC and schedules play", async () => {
    expect(await forceInternalArenaPair(arenaId,alpha,beta)).toEqual({status:"matched",gameId});
    expect(mocks.rpc).toHaveBeenCalledWith("match_internal_arena_bot_pair",expect.objectContaining({p_tournament_id:arenaId,p_first_bot_id:alpha,p_second_bot_id:beta}));
    await mocks.after.mock.calls[0][0]();
    expect(mocks.advance).toHaveBeenCalledWith(gameId);
  });
  it("keeps mixed pairing on the original human/bot path", async () => {
    await forceInternalArenaPair(arenaId,human,beta);
    expect(mocks.rpc).toHaveBeenCalledWith("match_internal_arena_bot",expect.objectContaining({p_student_id:human,p_bot_id:beta}));
  });
  it("rejects self-pairing and reports an unavailable bot without scheduling work", async () => {
    await expect(forceInternalArenaPair(arenaId,alpha,alpha)).rejects.toThrow("different players");
    mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"P0001",message:"Both bots must be available for pairing."}});
    await expect(forceInternalArenaPair(arenaId,alpha,beta)).rejects.toThrow("available");
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("retries challenge-code collisions", async () => {
    mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"23505"}});
    await forceInternalArenaPair(arenaId,alpha,beta);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("maps both saved nicknames into standings and pairings without a BOT suffix", async () => {
    tables.internal_arena_pairings.push({tournament_id:arenaId,id:"pairing",game_id:gameId,white_student_id:null,black_student_id:null,bot_id:alpha,bot_color:"white",bot_name:"Nova",opponent_bot_id:beta,opponent_bot_name:"Luna",status:"active"});
    tables.internal_arena_entries.forEach(entry=>{entry.status="playing";entry.current_game_id=gameId;});
    const lobby=await getTeacherInternalArenaLobby(arenaId);
    expect(lobby.arena.standings.map(entry=>entry.name).sort()).toEqual(["Luna","Nova"]);
    expect(lobby.pairings[0]).toMatchObject({whiteName:"Nova",blackName:"Luna",whiteStudentId:alpha,blackStudentId:beta});
    expect(mocks.after).toHaveBeenCalledTimes(1); // One game, not one job per bot.
  });
  it("pairs idle bots after the response, stopping when the queue has no pair", async () => {
    mocks.rpc.mockResolvedValueOnce({data:{status:"matched",gameId},error:null}).mockResolvedValueOnce({data:{status:"waiting"},error:null});
    await getTeacherInternalArenaLobby(arenaId);
    await mocks.after.mock.calls[0][0]();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenCalledWith("match_internal_arena_bot_pair",expect.objectContaining({p_first_bot_id:null,p_second_bot_id:null}));
  });
  it("keeps a removed, playing bot's current game running and exposes its removal state", async () => {
    tables.internal_arena_bots[0].removed_at=new Date().toISOString();
    tables.internal_arena_entries[0].status="playing";tables.internal_arena_entries[0].current_game_id=gameId;
    tables.internal_arena_entries[1].status="withdrawn";
    const lobby=await manageInternalArenaBot(arenaId,"remove",{},alpha);
    expect(mocks.rpc).toHaveBeenCalledWith("manage_internal_arena_bot",expect.objectContaining({p_action:"remove",p_bot_id:alpha}));
    expect(lobby.arena.standings[0]).toMatchObject({name:"Nova",status:"playing",bot:{removed:true}});
    await mocks.after.mock.calls[0][0]();
    expect(mocks.advance).toHaveBeenCalledWith(gameId);
  });
});
