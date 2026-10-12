import { describe, expect, it, vi, beforeEach } from "vitest";
import { Chess } from "chess.js";
import { HALLOWEEN_BOTS, HALLOWEEN_END, HALLOWEEN_START, HALLOWEEN_QUEST_ID, halloweenQuestState } from "@/lib/quests/halloween";
import { HALLOWEEN_BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { getBotProgression } from "@/chess/bots/progression";
import { validateCompletedGame } from "@/chess/persistence/completedGame";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({rpc:mocks.rpc}) }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseServiceConfigured: () => true, getSupabaseServiceClient: () => ({from:mocks.from}) }));
import { GET } from "@/app/api/student/seasonal-quest/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { saveSupabaseQuestTracking } from "@/lib/quests/supabaseQuestProgress";

function finishedGame(hintsUsed: unknown = 0) {
  const chess = new Chess();
  const moves = ["f3","e5","g4","Qh4#"].map(san => { const m=chess.move(san); return {from:m.from,to:m.to}; });
  return {opponentId:HALLOWEEN_BOTS[0].id,playerColor:"black",winnerColor:"black",result:"win",resultReason:"checkmate",timeControlId:"10+5",initialFen:new Chess().fen(),finalFen:chess.fen(),moves,hintsUsed,takebackCount:0,startedAt:"2026-10-11T01:00:00Z",completedAt:"2026-10-11T01:01:00Z"};
}

describe("Halloween Bot Hunt", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("includes all of November 1 in Bangkok and closes exactly at midnight", () => {
    expect(halloweenQuestState(false,Date.parse("2026-11-01T16:59:59.999Z"))).toBe("active");
    expect(halloweenQuestState(false,Date.parse("2026-11-01T17:00:00Z"))).toBe("expired");
    expect(halloweenQuestState(true,Date.parse("2027-01-01T00:00:00Z"))).toBe("completed");
    expect(halloweenQuestState(false,Date.parse(HALLOWEEN_START)-1)).toBe("upcoming");
    const sql=readFileSync("supabase/migrations/20261011054548_halloween_bot_quest.sql","utf8");
    expect(sql).toContain(HALLOWEEN_START);
    expect(sql).toContain(HALLOWEEN_END);
  });
  it("makes five increasingly capable opponents playable without regular ladder unlocks", () => {
    expect(HALLOWEEN_BOT_DIFFICULTIES.map(b=>b.estimatedRating)).toEqual([400,600,800,1000,1200]);
    const progression=getBotProgression(HALLOWEEN_BOTS.map(b=>b.id));
    expect(progression.unlockedBotIds).toContain(HALLOWEEN_BOTS[4].id);
    expect(progression.unlockedBotIds).not.toContain("knight");
    for(const [i,bot] of HALLOWEEN_BOT_DIFFICULTIES.entries()) {
      expect(bot.repertoireId).toBeUndefined();
      expect(bot.errorBands.reduce((total,b)=>total+b.weight,0)).toBeCloseTo(100);
      expect(bot.thinkTimeMs).toBeLessThan(550);
      if(i) expect(bot.qualityDiscipline).toBeGreaterThan(HALLOWEEN_BOT_DIFFICULTIES[i-1].qualityDiscipline);
    }
  });
  it("preserves assistance evidence while validating the actual legal game", () => {
    expect(validateCompletedGame(finishedGame()).hintsUsed).toBe(0);
    expect(validateCompletedGame(finishedGame(2)).hintsUsed).toBe(2);
    expect(validateCompletedGame({...finishedGame(),takebackCount:1}).takebackCount).toBe(1);
    for(const value of [-1,1.5,1001,undefined,null,"0",false]) expect(()=>validateCompletedGame({...finishedGame(),hintsUsed:value})).toThrow("Invalid hint count");
  });
  it("cannot persist seasonal tracking through generic browser quest writes", async () => {
    await saveSupabaseQuestTracking({attempts:[{id:"halloween-2026:fake",questId:"different"} as never],progress:[{questId:HALLOWEEN_QUEST_ID} as never],completions:[{id:"halloween-2026:fake",questId:"different"} as never]});
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reads only the signed-in student's progress and prevents response caching", async () => {
    mocks.auth.mockResolvedValue({studentId:"student-1"});
    const progress={enabled:true,defeatedBotIds:[],completed:false,completedAt:null};
    mocks.rpc.mockResolvedValue({data:progress,error:null});
    const result=await GET();
    expect(await result.json()).toEqual(progress);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("halloween_2026_progress",{p_student_id:"student-1"});
  });
  it("rejects signed-out access and returns a retryable error on database failure", async () => {
    mocks.auth.mockRejectedValue(new StudentAuthenticationError());
    expect((await GET()).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({studentId:"student-1"});
    mocks.rpc.mockResolvedValue({data:null,error:{message:"database issue"}});
    expect((await GET()).status).toBe(500);
  });
});
