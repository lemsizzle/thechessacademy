import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { ARENA_BOT_MIN_RATING, ARENA_BOT_MAX_RATING, ARENA_BOT_RATING_STEP, arenaBotDifficulty, arenaBotRatingId, MAX_ARENA_BOTS, parseArenaBotInput } from "@/chess/arena/bots";
import { chooseArenaBotMove } from "@/chess/engine/arenaStockfishServer";
import { readFileSync } from "node:fs";

describe("Arena bot configuration", () => {
  it("uses the existing skill presets with strict server-side validation", () => {
    expect(MAX_ARENA_BOTS).toBe(12);
    for (const bot of BOT_DIFFICULTIES) {
      expect(arenaBotDifficulty(bot.id)).toBe(bot);
      expect(parseArenaBotInput({ difficultyId: bot.id })).toEqual({ name: bot.name, difficultyId: bot.id });
    }
    expect(parseArenaBotInput({ name: "  Class   helper  ", difficultyId: "knight", rating: 9999 })).toEqual({ name: "Class helper", difficultyId: "knight" });
    for (const bad of [null, {}, { difficultyId: "impossible" }, { difficultyId: 3 }, { difficultyId: "rook", name: " " }, { difficultyId: "rook", name: "x".repeat(41) }]) {
      expect(() => parseArenaBotInput(bad)).toThrow();
    }
  });

  it("keeps every preset and the bot limit aligned with database validation", () => {
    const sql = readFileSync("supabase/migrations/20260907012638_internal_arena_bots.sql", "utf8");
    for (const bot of BOT_DIFFICULTIES) expect(sql).toContain(`'${bot.id}'`);
    expect(sql).toContain(">= 12");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("after insert or update of version, status");
    expect(sql).toContain("bot_lease_until < now()");
  });

  it("supports every slider step and changes engine strength between presets", () => {
    let previous = arenaBotDifficulty("pawny")!;
    for (let rating = ARENA_BOT_MIN_RATING; rating <= ARENA_BOT_MAX_RATING; rating += ARENA_BOT_RATING_STEP) {
      const id = arenaBotRatingId(rating);
      const bot = arenaBotDifficulty(id)!;
      expect(parseArenaBotInput({ difficultyId: id, name: "Luna" })).toEqual({ name: "Luna", difficultyId: id });
      expect(bot.estimatedRating).toBe(rating);
      expect(bot.qualityDiscipline).toBeGreaterThanOrEqual(previous.qualityDiscipline);
      expect(bot.maxPlausibleCpLoss).toBeLessThanOrEqual(previous.maxPlausibleCpLoss);
      expect(bot.thinkTimeMs).toBeGreaterThanOrEqual(previous.thinkTimeMs);
      expect(bot.multiPv).toBeGreaterThanOrEqual(6);
      expect(bot.multiPv).toBeLessThanOrEqual(10);
      expect(Number.isInteger(bot.multiPv)).toBe(true);
      expect(bot.errorBands.reduce((sum, band) => sum + band.weight, 0)).toBeCloseTo(100);
      expect(bot.repertoireId).toBeUndefined();
      previous = bot;
    }
    const midpoint = arenaBotDifficulty("arena-675")!;
    expect(midpoint.qualityDiscipline).toBeCloseTo(0.27);
    expect(midpoint.tacticalAwareness).toBeCloseTo(0.45);
    expect(midpoint.thinkTimeMs).toBe(290);
    expect(midpoint).not.toEqual(arenaBotDifficulty("knight"));
    expect(arenaBotDifficulty("so-pawny")?.repertoireId).toBe("so-pawny");
  });

  it("rejects malformed, out-of-range and off-step custom strengths", () => {
    for (const id of ["arena-374", "arena-1625", "arena-576", "arena-0575", "arena-575.0", "arena-5e2", "arena-575\n", "arena-NaN", "arena-999999999999", "arena--400"]) {
      expect(arenaBotDifficulty(id)).toBeNull();
      expect(() => parseArenaBotInput({ difficultyId: id })).toThrow("skill");
    }
    for (const rating of [NaN, Infinity, -25, 350, 576, 575.5, 1625]) expect(() => arenaBotRatingId(rating)).toThrow();
  });
});

describe("server-run Arena Stockfish", () => {
  it.each(BOT_DIFFICULTIES.map((bot) => [bot.id]))("plays a legal move using %s's actual skill preset", async (id) => {
    const chess = new Chess();
    chess.move("e4"); chess.move("e5"); chess.move("Nf3");
    const uci = await chooseArenaBotMove(chess.fen(), id, { moveHistory: ["e2e4", "e7e5", "g1f3"] });
    expect(() => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })).not.toThrow();
  }, 15_000);

  it("rejects invalid skill and terminal positions", async () => {
    await expect(chooseArenaBotMove(new Chess().fen(), "spoofed", { moveHistory: [] })).rejects.toThrow("skill");
    await expect(chooseArenaBotMove("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "queen", { moveHistory: [] })).rejects.toThrow("No move");
  });

  it.each([375, 675, 1000, 1600])("uses the real engine for custom strength %i", async (rating) => {
    const chess = new Chess();
    const move = await chooseArenaBotMove(chess.fen(), arenaBotRatingId(rating), { moveHistory: [] });
    expect(() => chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })).not.toThrow();
  }, 15_000);

  it("handles promotion on the server", async () => {
    const chess = new Chess("8/2P5/8/8/8/6k1/8/7K w - - 0 1");
    const move = await chooseArenaBotMove(chess.fen(), "queen", { moveHistory: [] });
    expect(move).toMatch(/^c7c8[qrbn]$/);
    expect(chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }).promotion).toBeTruthy();
  }, 15_000);
});
