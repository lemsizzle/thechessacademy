import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { existsSync, readFileSync } from "node:fs";
import { THANKSGIVING_HUNT as hunt, seasonalQuestState, isSeasonalQuest, SEASONAL_BOTS } from "@/lib/quests/seasonalBotHunts";
import { BOT_DIFFICULTIES, personalizedSeasonalBots } from "@/chess/bots/difficulties";
import { getBotProgression } from "@/chess/bots/progression";
import { validateCompletedGame } from "@/chess/persistence/completedGame";
import { seasonalReductionsFromGames, type HalloweenLossRecord } from "@/chess/bots/halloweenAdaptation";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseServiceConfigured: () => true, getSupabaseServiceClient: () => ({ from: mocks.from }) }));
import { GET } from "@/app/api/student/seasonal-quest/route";
import { saveSupabaseQuestTracking } from "@/lib/quests/supabaseQuestProgress";

describe("reusable seasonal bot hunts", () => {
  beforeEach(() => vi.clearAllMocks());
  it("provides five new unlocked opponents, matching art, and increasing real strengths", () => {
    expect(hunt.bots.map(bot => bot.rating)).toEqual([400,550,700,850,1000]);
    const all = getBotProgression([]).unlockedBotIds;
    for (const bot of hunt.bots) {
      expect(all).toContain(bot.id);
      expect(BOT_DIFFICULTIES.find(entry => entry.id === bot.id)?.estimatedRating).toBe(bot.rating);
      expect(existsSync(`public${bot.portrait}`)).toBe(true);
    }
    expect(new Set(SEASONAL_BOTS.map(bot => bot.id)).size).toBe(SEASONAL_BOTS.length);
    const strengths = hunt.bots.map(bot => BOT_DIFFICULTIES.find(entry => entry.id === bot.id)!);
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i].qualityDiscipline).toBeGreaterThan(strengths[i - 1].qualityDiscipline);
      expect(strengths[i].maxPlausibleCpLoss).toBeLessThan(strengths[i - 1].maxPlausibleCpLoss);
    }
    expect(strengths.at(-1)!.qualityDiscipline).toBeCloseTo(0.538);
    expect(existsSync(`public${hunt.badge!.image}`)).toBe(true);
  });
  it("includes November 27 in Pacific time and stops at exactly midnight", () => {
    expect(seasonalQuestState(hunt, false, Date.parse("2026-11-27T23:59:59.999-08:00"))).toBe("active");
    expect(seasonalQuestState(hunt, false, Date.parse("2026-11-28T15:00:00+07:00"))).toBe("expired");
    expect(seasonalQuestState(hunt, true, Date.parse("2026-12-01T00:00:00Z"))).toBe("completed");
    const sql = readFileSync("supabase/migrations/20261101095251_seasonal_bot_hunts.sql", "utf8");
    for (const value of [hunt.id,hunt.startsAt,hunt.endsAt,hunt.badge!.id,...hunt.bots.map(bot=>bot.id)]) expect(sql).toContain(value);
  });
  it("requires explicit assistance evidence for every holiday bot", () => {
    const chess = new Chess();
    const moves = ["f3","e5","g4","Qh4#"].map(san => { const m=chess.move(san);return {from:m.from,to:m.to}; });
    const payload = { opponentId:hunt.bots[0].id,playerColor:"black",winnerColor:"black",result:"win",resultReason:"checkmate",timeControlId:"10+5",initialFen:new Chess().fen(),finalFen:chess.fen(),moves,takebackCount:0,startedAt:hunt.startsAt,completedAt:"2026-11-01T01:00:00+07:00" };
    expect(()=>validateCompletedGame(payload)).toThrow("Invalid hint count");
    expect(validateCompletedGame({...payload,hintsUsed:0}).opponentId).toBe(hunt.bots[0].id);
  });
  it("reuses loss adaptation with independent Thanksgiving dates and opponents", () => {
    const chess = new Chess();
    "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#".split(" ").forEach(san=>chess.move(san));
    const record: HalloweenLossRecord = { id:"a",opponent_id:hunt.bots[0].id,player_color:"black",result:"loss",result_reason:"checkmate",initial_fen:new Chess().fen(),pgn:chess.pgn(),hints_used:0,takeback_count:0,started_at:"2026-11-20T10:00:00Z",completed_at:"2026-11-20T10:05:00Z",created_at:"2026-11-20T10:05:00Z" };
    const reductions = seasonalReductionsFromGames([record]);
    expect(reductions).toEqual({ [hunt.bots[0].id]:25 });
    expect(personalizedSeasonalBots(reductions).find(bot=>bot.id===hunt.bots[0].id)?.estimatedRating).toBe(375);
    expect(seasonalReductionsFromGames([{...record,created_at:hunt.endsAt}])).toEqual({});
  });
  it("fetches only the signed-in student's selected hunt and rejects unknown events", async () => {
    mocks.auth.mockResolvedValue({studentId:"student-1"});
    mocks.rpc.mockResolvedValue({data:{enabled:true,defeatedBotIds:[],completed:false,completedAt:null},error:null});
    const response=await GET(new Request(`https://example.com/api/student/seasonal-quest?questId=${hunt.id}&studentId=another`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("seasonal_bot_hunt_progress",{p_student_id:"student-1",p_quest_id:hunt.id});
    expect((await GET(new Request('https://example.com/api/student/seasonal-quest?questId=unknown'))).status).toBe(404);
  });
  it("blocks generic quest writes from inventing seasonal completions or changing their expiry", async () => {
    expect(isSeasonalQuest(hunt.id)).toBe(true);
    await saveSupabaseQuestTracking({ attempts:[{id:"forged",questId:hunt.id} as never,{id:"seasonal:future:forged",questId:"different"} as never],progress:[{questId:hunt.id} as never],completions:[{id:"forged",questId:hunt.id} as never] });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns a retryable error when a seasonal definition has not been deployed", async () => {
    mocks.auth.mockResolvedValue({studentId:"student-1"});
    mocks.rpc.mockResolvedValue({data:null,error:null});
    const response=await GET(new Request(`https://example.com/api/student/seasonal-quest?questId=${hunt.id}`));
    expect(response.status).toBe(500);
  });
});
