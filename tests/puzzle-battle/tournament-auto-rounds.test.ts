import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),deck:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseServiceClient:()=>({rpc:m.rpc})}));
vi.mock("@/lib/puzzle-battle/server",()=>({buildBattleDeck:m.deck}));
import { getPuzzleTournament } from "@/lib/puzzle-battle/tournamentServer";
const id="30000000-0000-4000-8000-000000000001";
const done={id,status:"active",version:4,round:1,rounds:3,mode:"survival",duration:60,startsAt:null as string|null,entries:[{id:"a",name:"A",studentId:"sa"},{id:"b",name:"B",studentId:"sb"}],matches:[{round:1,a:"a",b:"b",result:{winnerEntryId:"a",reason:"played"}}]};
const safe=(t:typeof done)=>({...t,entries:t.entries.map(e=>({...e,studentId:null}))});
let state:typeof done;
beforeEach(()=>{
  vi.clearAllMocks();state=structuredClone(done);m.deck.mockResolvedValue([{kind:"survival"}]);
  m.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
    if(name==="puzzle_tournament_snapshot") return {data:args.p_teacher?state:safe(state)};
    if(name==="claim_puzzle_tournament_round") return {data:true};
    if(name==="start_puzzle_tournament_round") state={...state,round:2,version:5};
    return {data:null};
  });
});
it("automatically creates the next round from a student result poll without exposing private roster data",async()=>{
  const t=await getPuzzleTournament(id,false,"sa");
  expect(t.round).toBe(2);expect(t.entries.every(e=>e.studentId===null)).toBe(true);
  expect(m.deck).toHaveBeenCalledOnce();
  expect(m.rpc).toHaveBeenCalledWith("start_puzzle_tournament_round",expect.objectContaining({p_version:4,p_pairs:[expect.objectContaining({a:"a",b:"b"})]}));
  expect(m.rpc).toHaveBeenCalledWith("release_puzzle_tournament_round",expect.objectContaining({p_id:id}));
});
it("does not generate duplicate decks while another request holds the preparation lease",async()=>{
  m.rpc.mockImplementation(async(name:string)=>({data:name==="puzzle_tournament_snapshot"?state:false}));
  await getPuzzleTournament(id,true);expect(m.deck).not.toHaveBeenCalled();
});
it.each(["waiting","finished","cancelled"])("does not auto-start a %s tournament",async status=>{
  state={...state,status};await getPuzzleTournament(id,true);
  expect(m.rpc.mock.calls.map(c=>c[0])).toEqual(["puzzle_tournament_snapshot"]);
});
it("waits for every battle and stops at the final round",async()=>{
  state={...state,matches:[{...state.matches[0],result:null as never}]};
  await getPuzzleTournament(id,true);expect(m.deck).not.toHaveBeenCalled();
  state={...done,round:3};await getPuzzleTournament(id,true);expect(m.deck).not.toHaveBeenCalled();
});
it("releases a failed preparation for retry and keeps the completed results visible",async()=>{
  m.deck.mockRejectedValue(new Error("Temporary failure"));
  const t=await getPuzzleTournament(id,false,"sa");
  expect(t.round).toBe(1);expect(t.advanceError).toContain("Retrying automatically");
  expect(m.rpc).toHaveBeenCalledWith("release_puzzle_tournament_round",expect.objectContaining({p_id:id}));
});
it("starts a due scheduled tournament from the student lobby",async()=>{
  state={...state,status:"waiting",round:0,matches:[],startsAt:new Date(Date.now()-1000).toISOString()};
  await getPuzzleTournament(id,false,"sa");expect(m.deck).toHaveBeenCalledOnce();
  expect(m.rpc).toHaveBeenCalledWith("claim_puzzle_tournament_round",expect.objectContaining({p_version:4}));
});
it("waits for the scheduled time and at least two players",async()=>{
  state={...state,status:"waiting",round:0,matches:[],startsAt:new Date(Date.now()+60000).toISOString()};
  await getPuzzleTournament(id,true);expect(m.deck).not.toHaveBeenCalled();
  state={...state,startsAt:new Date(Date.now()-1000).toISOString(),entries:state.entries.slice(0,1)};
  await getPuzzleTournament(id,true);expect(m.deck).not.toHaveBeenCalled();
});
it("does not start the newly rescheduled version after claiming the old schedule",async()=>{
  state={...state,status:"waiting",round:0,matches:[],startsAt:new Date(Date.now()-1000).toISOString()};
  m.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
    if(name==="claim_puzzle_tournament_round") {
      state={...state,version:5,startsAt:new Date(Date.now()+60000).toISOString()};
      return {data:true};
    }
    return {data:name==="puzzle_tournament_snapshot"?(args.p_teacher?state:safe(state)):null};
  });
  const t=await getPuzzleTournament(id,false,"sa");expect(t.version).toBe(5);expect(m.deck).not.toHaveBeenCalled();
});
