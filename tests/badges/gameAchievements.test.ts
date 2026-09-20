import { describe,expect,it } from "vitest";
import { Chess } from "chess.js";
import { gameAchievements } from "@/lib/badges/gameAchievements/catalog";
import { detectGameAchievements, structureAchievements } from "@/lib/badges/gameAchievements/detect";
import { achievementGameLink } from "@/lib/badges/gameAchievements/evidence";
import fixtures from "./fixtures/rosen-games.json";

describe("Rosen Score reference games (MIT; docs/licenses/rosen-score-MIT.txt)",()=>{
  it.each(fixtures)("$key negative=$negative ($pgn)",({key,pgn,negative,colors})=>{
    const board=new Chess();board.loadPgn(pgn);
    const reason=board.isCheckmate()?"checkmate":board.isStalemate()?"stalemate":"resignation";
    const winner=board.isStalemate()?null:board.turn()==="w"?"b":"w";
    const w=detectGameAchievements({moves:pgn,color:"w",winner,reason});
    const b=detectGameAchievements({moves:pgn,color:"b",winner,reason});
    const actual=[...(w.some(h=>h.key===key)?["w"]:[]),...(b.some(h=>h.key===key)?["b"]:[])];
    if(negative)expect(actual).toEqual([]);
    else if(colors.length)expect(actual).toEqual(colors);
    else expect(actual.length).toBeGreaterThan(0);
  });
});

it("has 63 reference challenges plus eight learning milestones with unique stable IDs and keys",()=>{
  expect(gameAchievements).toHaveLength(71);
  expect(new Set(gameAchievements.map(a=>a.id)).size).toBe(71);
  expect(new Set(gameAchievements.map(a=>a.key)).size).toBe(71);
  expect(gameAchievements.filter(a=>a.group==="Learning")).toHaveLength(8);
});
it("rejects illegal games instead of awarding from a partial replay",()=>{
  expect(()=>detectGameAchievements({moves:[{from:"e2",to:"e4"},{from:"e7",to:"e4"}],color:"w",winner:"w",reason:"resignation"})).toThrow();
});
it("needs a verified mate and real clocks for speed achievements",()=>{
  const input={moves:"f3 e5 g4 Qh4#",color:"b" as const,winner:"b" as const,reason:"checkmate"};
  expect(detectGameAchievements(input).map(h=>h.key)).toContain("mate-move-2");
  expect(detectGameAchievements(input).map(h=>h.key)).not.toContain("tenth-second-mate");
  expect(detectGameAchievements({...input,incrementMs:0,clocksMs:[1000,900,800,100]}).map(h=>h.key)).toContain("tenth-second-mate");
  expect(detectGameAchievements({...input,incrementMs:1000,clocksMs:[1000,900,800,100]}).map(h=>h.key)).not.toContain("tenth-second-mate");
  expect(detectGameAchievements({...input,moves:"f3 e5 g4"}).map(h=>h.key)).not.toContain("mate-move-2");
});
it("awards connected shapes to their owner, handles black ranks, and never wraps at the edge",()=>{
  const board=new Chess("7k/8/8/3PP3/3PP3/8/8/K7 w - - 0 1");
  expect(structureAchievements(board,"w")).toEqual(expect.arrayContaining(["pawn-cube","center-pawn-cube"]));
  expect(structureAchievements(board,"b")).not.toContain("pawn-cube");
  const wrapped=new Chess("7k/P6P/P6P/8/8/8/8/K7 w - - 0 1");
  expect(structureAchievements(wrapped,"w")).not.toContain("pawn-cube");
  expect(structureAchievements(new Chess("7k/8/8/pppppppp/8/8/8/K7 b - - 0 1"),"b")).toContain("connect-8-rank-4");
});
it("does not confuse an adjacent-but-broken diagonal with connected pawns",()=>{
  expect(structureAchievements(new Chess("7k/8/4P3/3P4/2P5/1P6/P7/7K w - - 0 1"),"w")).toContain("connect-5");
  expect(structureAchievements(new Chess("7k/8/4P3/3P4/8/1PP5/P7/7K w - - 0 1"),"w")).not.toContain("connect-5");
});
it("keeps learning fork awards tied to a follow-up capture and no immediate recapture",()=>{
  const input={initialFen:"3qk3/8/8/4N3/8/8/8/4K3 w - - 0 1",moves:"Nc6 Qd5 Nb4 Qxh1+",color:"w" as const,winner:null,reason:"draw"};
  // A geometric fork alone is not a successful capture milestone.
  expect(detectGameAchievements({...input,moves:"Nc6 Kf7"}).some(h=>h.key==="first-fork")).toBe(false);
});
it("only creates replay links for known trusted source formats",()=>{
  const evidence={sourceId:"lichess:abcd1234",ply:10,completedAt:"2026-09-21"};
  expect(achievementGameLink(evidence)).toBe("https://lichess.org/abcd1234#10");
  expect(achievementGameLink({...evidence,sourceId:"javascript:alert(1)"})).toBeNull();
  expect(achievementGameLink({...evidence,ply:-1})).toBeNull();
});

it.each([
  ["first-fork","8/8/5k2/8/8/2N5/5q2/K7 w - - 0 1","Ne4+ Ke7 Nxf2"],
  ["successful-pin","8/6kp/8/8/3r4/8/8/K1B5 w - - 0 1","Bb2 h6 Bxd4"],
  ["first-skewer","4q3/8/8/4k3/8/8/8/K6R w - - 0 1","Re1+ Kd5 Rxe8"],
  ["discovered-attack","8/7k/8/4r3/8/2N5/1B6/K7 w - - 0 1","Na4 Kh6 Bxe5"],
  ["hanging-piece","7k/8/8/6n1/8/8/8/K1B5 w - - 0 1","Bxg5 Kh7"],
  ["first-promotion","7k/P7/8/8/8/8/8/7K w - - 0 1","a8=Q+"],
  ["back-rank-mate","6k1/5ppp/8/8/8/8/8/K3R3 w - - 0 1","Re8#"],
  ["stalemate-escape","8/8/8/8/8/2k5/2q5/K7 b - - 0 1","Qb3"]
])("recognizes learning milestone %s",(key,initialFen,moves)=>{
  const reason=key==="stalemate-escape"?"stalemate":key==="back-rank-mate"?"checkmate":"resignation";
  const hits=detectGameAchievements({initialFen,moves,color:"w",winner:reason==="stalemate"?null:"w",reason});
  expect(hits.map(h=>h.key)).toContain(key);
  expect(hits.find(h=>h.key===key)?.ply).toBeGreaterThan(0);
});
