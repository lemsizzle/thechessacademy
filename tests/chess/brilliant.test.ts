import { describe, it, expect, vi } from "vitest";
import { Chess } from "chess.js";
import { offeredSacrifice, isSoundBrilliance, findBrilliantMoves } from "@/chess/analysis/brilliant";
import { createAnalysisTree } from "@/chess/analysis/tree";
import type { StockfishCandidate } from "@/chess/types";

const fen = "5r1k/6pp/4Q2N/8/8/8/8/7K w - - 0 1";
const line = (uci: string, rank: number, cp: number, overrides: Partial<StockfishCandidate> = {}): StockfishCandidate => ({ uci, rank, scoreCp: cp, mate: null, depth: 16, pv: [uci], ...overrides });
const before = [line("e6g8", 1, 100), line("e6h3", 2, 20)];
const after = [line("f8g8", 1, -90)];

describe("brilliant sacrifices", () => {
  it("recognizes a queen offer and accounts for recapture", () => {
    expect(offeredSacrifice(fen, "e6g8")).toMatchObject({ piece: "queen", square: "g8" });
  });
  it("rejects ordinary moves, pawn offers, equal trades and captures already paid for", () => {
    expect(offeredSacrifice(new Chess().fen(), "e2e4")).toBeNull();
    expect(offeredSacrifice("7k/8/8/3p4/8/4P3/8/7K w - - 0 1", "e3e4")).toBeNull();
    expect(offeredSacrifice("3rk3/3r4/8/8/8/8/3R4/7K w - - 0 1", "d2d7")).toBeNull();
  });
  it("does not celebrate a piece that was already hanging", () => {
    expect(offeredSacrifice("3rk3/8/8/8/3Q4/8/8/7K w - - 0 1", "h1h2")).toBeNull();
  });
  it("ignores pinned captures and recognizes Black's queen offer", () => {
    expect(offeredSacrifice("4k3/4r3/8/8/8/8/6B1/4R2K w - - 0 1", "g2c6")).toBeNull();
    expect(offeredSacrifice("7k/8/8/8/8/4q2n/6PP/5R1K b - - 0 1", "e3g1")).toMatchObject({ piece: "queen", square: "g1" });
  });
  it("requires near-best play and a sound position against best defense", () => {
    expect(isSoundBrilliance(before, after, "e6g8")).toBe(true);
    expect(isSoundBrilliance(before, [line("f8g8", 1, 100)], "e6g8")).toBe(false);
    expect(isSoundBrilliance([line("e6h3", 1, 200), line("e6g8", 2, 100)], after, "e6g8")).toBe(false);
    expect(isSoundBrilliance(before, [line("f8g8", 1, 0)], "e6g8")).toBe(false);
  });
  it("rejects easy winning alternatives, forced or missing lines, low depth and bounds", () => {
    expect(isSoundBrilliance([before[0], line("e6h3", 2, 350)], after, "e6g8")).toBe(false);
    expect(isSoundBrilliance([before[0]], after, "e6g8")).toBe(false);
    expect(isSoundBrilliance(before, [{ ...after[0], depth: 5 }], "e6g8")).toBe(false);
    expect(isSoundBrilliance(before, [{ ...after[0], bound: "lower" }], "e6g8")).toBe(false);
    expect(isSoundBrilliance(before, [], "e6g8")).toBe(false);
    expect(isSoundBrilliance(before, after, "h1h2")).toBe(false);
  });
  it("handles mating scores without rewarding an allowed mate", () => {
    const winning = [line("e6g8", 1, 0, { mate: 2 }), before[1]];
    expect(isSoundBrilliance(winning, [line("f8g8", 1, 0, { mate: -1 })], "e6g8")).toBe(true);
    expect(isSoundBrilliance(winning, [line("f8g8", 1, 0, { mate: 1 })], "e6g8")).toBe(false);
  });
  it("checks the actual capture continuation and cancels without publishing results", async () => {
    const board = new Chess(fen); const m = board.move("Qg8+");
    const tree = createAnalysisTree(fen, [{ from: m.from, to: m.to, san: m.san, color: "white", ply: 1, fenAfter: board.fen() }]);
    const analyze = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after).mockResolvedValueOnce([line("h6f7", 1, 100)]);
    expect(await findBrilliantMoves(tree, "white", analyze, () => false)).toHaveLength(1);
    expect(analyze).toHaveBeenCalledTimes(3);
    const badCapture = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after).mockResolvedValueOnce([line("h6f7", 1, -200)]);
    expect(await findBrilliantMoves(tree, "white", badCapture, () => false)).toEqual([]);
    const cancelled = vi.fn();
    expect(await findBrilliantMoves(tree, "white", cancelled, () => true)).toEqual([]);
    expect(cancelled).not.toHaveBeenCalled();
    expect(await findBrilliantMoves(tree, "black", cancelled, () => false)).toEqual([]);
    const screened = [{ nodeId: tree.rootId, bestMoveUci: "h6f7", acceptedMovesUci: ["h6f7"], scoreWhiteCp: 0, mateWhite: null, bestLineSan: "", depth: 14 }];
    expect(await findBrilliantMoves(tree, "white", cancelled, () => false, undefined, screened)).toEqual([]);
    expect(cancelled).not.toHaveBeenCalled();
  });
  it("uses side-to-move and real move numbers for a game starting with Black", async () => {
    const start = "7k/8/8/8/8/4q2n/6PP/5R1K b - - 0 20";
    const board = new Chess(start), move = board.move("Qg1+");
    const tree = createAnalysisTree(start, [{ from: move.from, to: move.to, san: move.san, color: "black", ply: 40, fenAfter: board.fen() }]);
    const analyze = vi.fn().mockResolvedValueOnce([line("e3g1", 1, 100), line("e3h6", 2, 0)])
      .mockResolvedValueOnce([line("f1g1", 1, -100)]).mockResolvedValueOnce([line("h3f2", 1, 100)]);
    const result = await findBrilliantMoves(tree, "black", analyze, () => false);
    expect(result[0]?.moveLabel).toBe("20… Qg1+");
    expect(result[0]?.explanation).toContain("Nf2# is checkmate");
  });
});
