import { Chess, DEFAULT_POSITION } from "chess.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { halloweenReductionsFromGames, type HalloweenLossRecord } from "@/chess/bots/halloweenAdaptation";
import { HALLOWEEN_BOT_DIFFICULTIES, personalizedHalloweenBots, STANDARD_BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { HALLOWEEN_BOTS } from "@/lib/quests/halloween";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
import { getStudentHalloweenReductions } from "@/chess/persistence/halloweenAdaptationServer";

const opera = "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#";
export function loss(index = 0, overrides: Partial<HalloweenLossRecord> = {}): HalloweenLossRecord {
  const chess = new Chess();
  const whiteKnight = ["f3", "h3", "c3", "a3"][index % 4];
  const blackKnight = index < 4 ? "f6" : "c6";
  if (index) {
    for (const san of [`N${whiteKnight}`, `N${blackKnight}`, whiteKnight === "f3" || whiteKnight === "h3" ? "Ng1" : "Nb1", blackKnight === "f6" ? "Ng8" : "Nb8"]) chess.move(san);
  }
  for (const san of opera.split(" ")) chess.move(san);
  const completed = Date.parse("2026-10-26T10:03:00+07:00") + Math.floor(index / 2) * 86_400_000 + (index % 2) * 300_000;
  return {
    id: `game-${index}`, opponent_id: HALLOWEEN_BOTS[0].id, player_color: "black", result: "loss",
    result_reason: "checkmate", initial_fen: DEFAULT_POSITION, pgn: chess.pgn(), takeback_count: 0, hints_used: 0,
    started_at: new Date(completed - 180_000).toISOString(), completed_at: new Date(completed).toISOString(), created_at: new Date(completed).toISOString(),
    ...overrides
  };
}

describe("personal Halloween difficulty", () => {
  it("reduces only the opponent from a played-out, unassisted checkmate", () => {
    expect(halloweenReductionsFromGames([loss()])).toEqual({ [HALLOWEEN_BOTS[0].id]: 25 });
    expect(halloweenReductionsFromGames([loss(0, { opponent_id: "pawny" })])).toEqual({});
  });

  it.each([
    { result: "win" }, { result: "draw" }, { result_reason: "resignation" }, { result_reason: "timeout" },
    { hints_used: 1 }, { takeback_count: 1 }, { pgn: "garbage" }, { player_color: "white" },
    { started_at: "2026-10-26T10:02:00+07:00" }, { started_at: "2026-10-25T10:00:00+07:00" },
    { created_at: "2026-11-02T00:00:00+07:00" }, { completed_at: "2027-01-01T00:00:00Z" }
  ])("rejects nonqualifying loss %j", (changes) => {
    expect(halloweenReductionsFromGames([loss(0, changes)])).toEqual({});
  });

  it("rejects a deliberately quick mate even after waiting two minutes", () => {
    const chess = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) chess.move(san);
    expect(halloweenReductionsFromGames([loss(0, { pgn: chess.pgn(), player_color: "white" })])).toEqual({});
  });

  it("deduplicates game uploads even with different IDs, dates, or PGN headers", () => {
    const first = loss();
    const repeat = loss(2, { pgn: `[Event "Another upload"]\n\n${first.pgn}` });
    expect(halloweenReductionsFromGames([repeat, first])).toEqual({ [first.opponent_id]: 25 });
  });

  it("caps each bot at two reductions per Bangkok day and rejects rapid upload bursts", () => {
    const first = loss(), second = loss(1), third = loss(2, { created_at: "2026-10-26T10:15:00+07:00", started_at: "2026-10-26T10:12:00+07:00", completed_at: "2026-10-26T10:15:00+07:00" });
    expect(halloweenReductionsFromGames([third, second, first])[first.opponent_id]).toBe(50);
    expect(halloweenReductionsFromGames([first, loss(1, { created_at: first.created_at, completed_at: first.completed_at, started_at: first.started_at })])[first.opponent_id]).toBe(25);
  });

  it("persists reductions over days, caps at 200, and keeps each bot independent", () => {
    const games = Array.from({ length: 8 }, (_, i) => loss(i));
    const other = loss(0, { opponent_id: HALLOWEEN_BOTS[1].id });
    expect(halloweenReductionsFromGames([...games, other])).toEqual({ [games[0].opponent_id]: 200, [other.opponent_id]: 25 });
    expect(halloweenReductionsFromGames([...games, loss(1, { created_at: "2026-10-31T10:03:00+07:00" })])[games[0].opponent_id]).toBe(200);
  });

  it("lowers actual engine discipline and awareness, including below Pawny, without changing shared bots", () => {
    const reductions = Object.fromEntries(HALLOWEEN_BOTS.map((bot) => [bot.id, 200]));
    const adjusted = personalizedHalloweenBots(reductions);
    adjusted.forEach((bot, i) => {
      expect(bot.estimatedRating).toBe(HALLOWEEN_BOTS[i].rating - 200);
      expect(bot.qualityDiscipline).toBeLessThan(HALLOWEEN_BOT_DIFFICULTIES[i].qualityDiscipline);
      expect(bot.tacticalAwareness).toBeLessThan(HALLOWEEN_BOT_DIFFICULTIES[i].tacticalAwareness);
      expect(bot.errorBands.reduce((sum, band) => sum + band.weight, 0)).toBeCloseTo(100);
    });
    expect(STANDARD_BOT_DIFFICULTIES[0].estimatedRating).toBe(375);
    expect(HALLOWEEN_BOT_DIFFICULTIES.map((bot) => bot.estimatedRating)).toEqual([400, 600, 800, 1000, 1200]);
    expect(personalizedHalloweenBots({ [HALLOWEEN_BOTS[0].id]: 9999 })[0].estimatedRating).toBe(200);
  });
});

describe("Halloween saved-game query", () => {
  beforeEach(() => mocks.client.mockReset());
  it("uses only the authenticated student's saved games and a bounded compact projection", async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const key of ["select", "eq", "not", "in", "gte", "lt", "order"]) query[key] = vi.fn(() => query);
    query.limit = vi.fn().mockResolvedValue({ data: [loss()], error: null });
    const from = vi.fn(() => query);
    mocks.client.mockReturnValue({ from });
    await expect(getStudentHalloweenReductions("student-a")).resolves.toEqual({ [HALLOWEEN_BOTS[0].id]: 25 });
    expect(query.eq).toHaveBeenCalledWith("player_id", "student-a");
    expect(query.eq).toHaveBeenCalledWith("opponent_type", "computer");
    expect(query.limit).toHaveBeenCalledWith(500);
    expect(query.select.mock.calls[0][0]).not.toContain("moves");
    query.limit.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    await expect(getStudentHalloweenReductions("student-a")).rejects.toThrow("could not be loaded");
  });
});
