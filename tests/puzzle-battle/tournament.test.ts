import { describe, expect, it } from "vitest";
import { pairTournamentRound, tournamentStandings, type TournamentEntry, type TournamentMatch } from "@/lib/puzzle-battle/tournament";
import { ratedBotParameters, simulateTournamentBots } from "@/lib/puzzle-battle/tournamentBots";
const entries: TournamentEntry[] = Array.from({length:5},(_,i)=>({id:String(i),name:`Player ${i}`,studentId:i<3 ? String(i):null,elo:i<3?null:800}));
const match = (a: string,b: string|null,winnerEntryId: string|null): TournamentMatch => ({id:a+b,round:1,a,b,battleId:null,result:{winnerEntryId,scoreA:1,scoreB:0,reason:b?"played":"bye"},scoreA:1,scoreB:0});
describe("puzzle tournaments",()=>{
  it("gives late entrants zero points for missed rounds and includes them in the next pairings",()=>{
    const late={id:"late",name:"Late player",studentId:"new-student",elo:null};
    const t={entries:[...entries.slice(0,3),late],matches:[match("0","1","0"),match("2",null,"2")]};
    expect(tournamentStandings(t).find(e=>e.id==="late")).toMatchObject({points:0,played:0,byes:0});
    expect(pairTournamentRound(t).flatMap(([a,b])=>[a.id,b?.id])).toContain("late");
  });
  it("scores wins, draws and rotating byes without eliminating anyone",()=>{
    const matches=[match("0","1","0"),match("2","3",null),match("4",null,"4")];
    const rows=tournamentStandings({entries,matches});
    expect(rows.find(r=>r.id==="0")).toMatchObject({points:2,wins:1,rank:1});
    expect(rows.find(r=>r.id==="4")).toMatchObject({points:2,byes:1,rank:1});
    expect(rows.find(r=>r.id==="2")).toMatchObject({points:1,draws:1});
    const pairs=pairTournamentRound({entries,matches});
    expect(pairs.flatMap(([a,b])=>b?[a.id,b.id]:[a.id]).sort()).toEqual(entries.map(e=>e.id));
    expect(pairs.find(([,b])=>!b)?.[0].id).not.toBe("4");
    for(const [a,b] of pairs) if(b) expect(matches.some(m=>(m.a===a.id&&m.b===b.id)||(m.a===b.id&&m.b===a.id))).toBe(false);
  });
  it("permits two players to keep playing across rounds",()=>{
    expect(pairTournamentRound({entries:entries.slice(0,2),matches:[match("0","1","0")]})).toHaveLength(1);
  });
  it("puts humans in slot zero against a bot",()=>{
    const pair=pairTournamentRound({entries:[entries[4],entries[0]],matches:[]})[0];
    expect(pair[0].studentId).toBe("0");
  });
  it("uses teacher Elo continuously to change pace and accuracy",()=>{
    expect(ratedBotParameters(1200).pace).toBeLessThan(ratedBotParameters(400).pace);
    expect(ratedBotParameters(1200).accuracy).toBeGreaterThan(ratedBotParameters(400).accuracy);
    expect(()=>ratedBotParameters(0)).toThrow();
  });
  it("uses one-board instant-loss rules for bot-versus-bot Hide and Seek",()=>{
    expect(simulateTournamentBots("hide-and-seek",60,[[{atMs:10000,solved:false}],[{atMs:12000,solved:true}]])).toMatchObject({winnerSlot:1,afterMs:10000});
    expect(simulateTournamentBots("hide-and-seek",60,[[{atMs:70000,solved:true}],[{atMs:80000,solved:true}]])).toMatchObject({winnerSlot:null,afterMs:60000});
    expect(simulateTournamentBots("hide-and-seek",60,[[{atMs:10000,solved:true}],[{atMs:10000,solved:true}]])).toMatchObject({winnerSlot:null});
  });
  it("ends a bot run after three misses and respects time boundaries",()=>{
    const misses=[1,2,3,4].map(n=>({atMs:n*8000,solved:n===4}));
    expect(simulateTournamentBots("survival",60,[misses,[{atMs:60000,solved:true}]])).toMatchObject({score:[0,0],winnerSlot:null});
  });
});
