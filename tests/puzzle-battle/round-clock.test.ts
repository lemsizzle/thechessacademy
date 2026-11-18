import { expect, it } from "vitest";
import { tournamentRoundClock } from "@/lib/puzzle-battle/roundClock";
import type { PuzzleTournament } from "@/lib/puzzle-battle/tournament";
const t: Parameters<typeof tournamentRoundClock>[0] = {status:"active",round:2,roundStartsAt:10000,duration:60,matches:[{round:2,result:null} as PuzzleTournament["matches"][number]]};
it("separates the shared ready countdown from the battle time limit",()=>{
  expect(tournamentRoundClock(t,0)).toMatchObject({label:"Round starts in",seconds:10});
  expect(tournamentRoundClock(t,9999).seconds).toBe(1);
  expect(tournamentRoundClock(t,10000)).toMatchObject({label:"Round time left",seconds:60});
  expect(tournamentRoundClock(t,12340).seconds).toBe(58);
  expect(tournamentRoundClock(t,70000)).toMatchObject({label:"Time up · confirming results",seconds:0,running:false});
  expect(tournamentRoundClock(t,90000).seconds).toBe(0);
});
it("stops immediately for early completion and cancellation rather than showing leftover time",()=>{
  const finished={...t,matches:[{round:1,result:null},{round:2,result:{winnerEntryId:null}}] as PuzzleTournament["matches"]};
  expect(tournamentRoundClock(finished,12000)).toMatchObject({label:"Round complete",seconds:0});
  expect(tournamentRoundClock({...t,status:"finished"},12000)).toMatchObject({label:"Tournament complete",seconds:0});
  expect(tournamentRoundClock({...t,status:"cancelled"},12000)).toMatchObject({label:"Tournament cancelled",seconds:0});
});
it("uses the current round's saved start and never invents time for an older record",()=>{
  expect(tournamentRoundClock({...t,roundStartsAt:90000},90000).seconds).toBe(60);
  expect(tournamentRoundClock({...t,roundStartsAt:null},12000)).toMatchObject({seconds:null,running:false});
});
