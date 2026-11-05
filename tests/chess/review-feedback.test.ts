import { describe, expect, it, vi } from "vitest";
import { concreteMistakeReason, isGoodReviewMove, reviewHint, scoreReviewMove } from "@/chess/analysis/reviewFeedback";
import type { StockfishCandidate } from "@/chess/types";

const queen = "3rk3/8/8/8/3Q4/8/8/7K w - - 0 1";
const cp = (value: number) => ({ cp: value, mate: null });
const mate = (value: number) => ({ cp: null, mate: value });

describe("key moment teaching feedback", () => {
  it("names the hanging piece, square, and legal capture", () => {
    expect(concreteMistakeReason(queen, "h1h2", "Rxd4 Kg3"))
      .toContain("hangs your queen on d4. Your opponent can play Rxd4");
  });
  it("does not call an equal trade a hanging piece", () => {
    const fen = "3r2k1/8/8/3p4/4P3/8/8/3R3K w - - 0 1";
    const result = concreteMistakeReason(fen, "h1h2", "dxe4 Rxd8+ Kf7");
    expect(result).not.toContain("hangs");
    expect(result).not.toContain("loses material");
  });
  it("explains immediate and forced checkmate without fictional pawn values", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2";
    expect(concreteMistakeReason(fen, "g2g4", "Qh4#", true)).toContain("allows checkmate with Qh4#");
    expect(concreteMistakeReason(queen, "h1h2", "Rxd4 Kg3", true)).toContain("allows checkmate: your opponent starts with Rxd4");
  });
  it("hints at the piece before giving the destination and promotion", () => {
    expect(reviewHint(queen, "d4g4", 1)).toContain("queen on d4");
    expect(reviewHint(queen, "d4g4", 1)).not.toContain("g4");
    expect(reviewHint(queen, "d4g4", 2)).toContain("from d4 to g4");
    expect(reviewHint("7k/P7/8/8/8/8/8/7K w - - 0 1", "a7a8n", 2)).toContain("promoting to a knight");
  });
});

describe("good alternative moves", () => {
  it("accepts sound alternatives but rejects another material loss", () => {
    expect(isGoodReviewMove(cp(30), cp(-40))).toBe(true);
    expect(isGoodReviewMove(cp(30), cp(-70))).toBe(false);
    expect(isGoodReviewMove(cp(-200), cp(-210))).toBe(true);
    expect(isGoodReviewMove(cp(400), cp(100))).toBe(false);
  });
  it("accepts different winning mates, not allowing mate or throwing away a win", () => {
    expect(isGoodReviewMove(mate(2), mate(5))).toBe(true);
    expect(isGoodReviewMove(mate(2), cp(400))).toBe(true);
    expect(isGoodReviewMove(mate(2), cp(0))).toBe(false);
    expect(isGoodReviewMove(cp(0), mate(-4))).toBe(false);
    expect(isGoodReviewMove(mate(-2), mate(-4))).toBe(false);
  });
  it.each([
    [queen, "d4g4"],
    ["7k/8/8/3q4/8/8/8/3RK3 b - - 0 1", "d5g5"]
  ])("scores either color from the learner's perspective", async (fen, uci) => {
    const analyze = vi.fn().mockResolvedValue([{ rank: 1, scoreCp: -220, mate: null } as StockfishCandidate]);
    expect(await scoreReviewMove(fen, uci, analyze)).toEqual(cp(220));
    expect(analyze).toHaveBeenCalledOnce();
  });
  it("scores checkmate, stalemate, and promotion without waiting for engine lines", async () => {
    const analyze = vi.fn();
    expect(await scoreReviewMove("7k/5K2/6Q1/8/8/8/8/8 w - - 0 1", "g6g7", analyze)).toEqual(mate(1));
    expect(await scoreReviewMove("7k/5K2/6Q1/8/8/8/8/8 w - - 0 1", "g6f5", analyze)).toEqual(cp(0));
    expect(await scoreReviewMove("7k/5KP1/8/8/8/8/8/8 w - - 0 1", "g7g8q", analyze)).toEqual(mate(1));
    expect(analyze).not.toHaveBeenCalled();
  });
  it("does not mark engine failure or bounded scores as a wrong move", async () => {
    await expect(scoreReviewMove(queen, "d4g4", async () => [])).rejects.toThrow("could not check");
    await expect(scoreReviewMove(queen, "d4g4", async () => [{ rank: 1, scoreCp: 20, mate: null, bound: "lower", uci: "e8f7", depth: 12, pv: ["e8f7"] }])).rejects.toThrow();
  });
});
