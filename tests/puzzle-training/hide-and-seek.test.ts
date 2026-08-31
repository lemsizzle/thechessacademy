import { describe, expect, it } from "vitest";
import {
  HIDE_AND_SEEK_ARMY,
  HIDE_AND_SEEK_MAX_SAFE_SQUARES,
  HIDE_AND_SEEK_MIN_SAFE_SQUARES,
  calculateHideAndSeekAttackedSquares,
  calculateHideAndSeekSafeSquares,
  calculateHideAndSeekScore,
  generateHideAndSeekBoard,
  generateHideAndSeekBoardForVersion,
  hideAndSeekBoardFen,
  isHideAndSeekMode,
  isHideAndSeekSquare,
  type HideAndSeekPieceCode,
  type HideAndSeekPiecePlacement,
  type HideAndSeekSquare
} from "@/lib/puzzle-training/hideAndSeek";

function placement(piece: HideAndSeekPieceCode, square: HideAndSeekSquare): HideAndSeekPiecePlacement {
  return { piece, square };
}

function attackedBy(piece: HideAndSeekPieceCode, square: HideAndSeekSquare) {
  return calculateHideAndSeekAttackedSquares([placement(piece, square)]);
}

describe("Hide and Seek rules", () => {
  it("validates algebraic board squares", () => {
    for (const square of ["a1", "h1", "a8", "h8", "d5"]) {
      expect(isHideAndSeekSquare(square), square).toBe(true);
    }
    for (const value of ["a0", "a9", "i1", "A1", "a10", "", null, 42]) {
      expect(isHideAndSeekSquare(value), String(value)).toBe(false);
    }
  });

  it("accepts only supported search modes", () => {
    expect(isHideAndSeekMode("classic")).toBe(true);
    expect(isHideAndSeekMode("time_trial")).toBe(true);
    expect(isHideAndSeekMode("timed")).toBe(false);
  });

  it("uses knight jumps", () => {
    expect(attackedBy("bN", "d4")).toEqual([
      "c2", "e2", "b3", "f3", "b5", "f5", "c6", "e6"
    ]);
  });

  it("uses king adjacency without including its own square", () => {
    expect(attackedBy("bK", "d4")).toEqual([
      "c3", "d3", "e3", "c4", "e4", "c5", "d5", "e5"
    ]);
  });

  it("uses rook files and ranks", () => {
    expect(attackedBy("bR", "d4")).toEqual([
      "d1", "d2", "d3", "a4", "b4", "c4", "e4", "f4", "g4", "h4", "d5", "d6", "d7", "d8"
    ]);
  });

  it("uses bishop diagonals", () => {
    expect(attackedBy("bB", "d4")).toEqual([
      "a1", "g1", "b2", "f2", "c3", "e3", "c5", "e5", "b6", "f6", "a7", "g7", "h8"
    ]);
  });

  it("gives the queen both rook and bishop vision", () => {
    const queen = attackedBy("bQ", "d4");
    const rookAndBishop = new Set([
      ...attackedBy("bR", "d4"),
      ...attackedBy("bB", "d4")
    ]);
    expect(queen).toHaveLength(27);
    expect(new Set(queen)).toEqual(rookAndBishop);
  });

  it("stops every slider at the first occupied square", () => {
    const rookSafe = calculateHideAndSeekSafeSquares([
      placement("bR", "a1"),
      placement("bN", "a3")
    ]);
    expect(rookSafe).toContain("a4");
    expect(rookSafe).not.toContain("a2");

    const bishopSafe = calculateHideAndSeekSafeSquares([
      placement("bB", "a1"),
      placement("bN", "c3")
    ]);
    expect(bishopSafe).toContain("d4");
    expect(bishopSafe).not.toContain("b2");

    const queenSafe = calculateHideAndSeekSafeSquares([
      placement("bQ", "a1"),
      placement("bN", "a3")
    ]);
    expect(queenSafe).toContain("a4");
    expect(queenSafe).not.toContain("a2");
  });

  it("never classifies an occupied square as safe", () => {
    const pieces = [placement("bN", "d4")];
    expect(calculateHideAndSeekAttackedSquares(pieces)).not.toContain("d4");
    expect(calculateHideAndSeekSafeSquares(pieces)).not.toContain("d4");
  });

  it("rejects duplicate placements", () => {
    expect(() => calculateHideAndSeekSafeSquares([
      placement("bK", "e4"),
      placement("bQ", "e4")
    ])).toThrow(/occupied more than once/);
  });
});

describe("Hide and Seek generator", () => {
  it("is deterministic for a seed and varies across seeds", () => {
    expect(generateHideAndSeekBoard("same-seed")).toEqual(generateHideAndSeekBoard("same-seed"));
    expect(generateHideAndSeekBoard("first-seed").pieces).not.toEqual(
      generateHideAndSeekBoard("second-seed").pieces
    );
  });

  it("keeps issued generator versions replayable and rejects unknown versions", () => {
    expect(generateHideAndSeekBoardForVersion(1, "same-seed")).toEqual(
      generateHideAndSeekBoard("same-seed")
    );
    expect(() => generateHideAndSeekBoardForVersion(999, "same-seed")).toThrow(/no longer supported/i);
  });

  it("always places exactly the standard black non-pawn army on unique squares", () => {
    for (let index = 0; index < 100; index += 1) {
      const board = generateHideAndSeekBoard(`army-${index}`);
      expect(board.pieces.map((piece) => piece.piece).sort()).toEqual([...HIDE_AND_SEEK_ARMY].sort());
      expect(new Set(board.pieces.map((piece) => piece.square))).toHaveLength(8);
      expect(board.safeSquares).toEqual(calculateHideAndSeekSafeSquares(board.pieces));
      expect(board.safeSquares.some((square) => board.pieces.some((piece) => piece.square === square))).toBe(false);
    }
  });

  it("keeps a broad sample inside the requested safe-square range", () => {
    const signatures = new Set<string>();
    for (let index = 0; index < 1_000; index += 1) {
      const board = generateHideAndSeekBoard(`range-${index}`);
      expect(board.safeSquares.length).toBeGreaterThanOrEqual(HIDE_AND_SEEK_MIN_SAFE_SQUARES);
      expect(board.safeSquares.length).toBeLessThanOrEqual(HIDE_AND_SEEK_MAX_SAFE_SQUARES);
      signatures.add(board.pieces.map((piece) => `${piece.piece}${piece.square}`).join("|"));
    }
    expect(signatures.size).toBeGreaterThan(990);
  });

  it("returns plain serializable data and a renderer-ready FEN", () => {
    const board = generateHideAndSeekBoard("serialization");
    expect(JSON.parse(JSON.stringify(board))).toEqual(board);
    expect(hideAndSeekBoardFen(board.pieces)).toMatch(
      /^(?:[1-8kqrbn]+\/){7}[1-8kqrbn]+ b - - 0 1$/
    );
  });
});

describe("Hide and Seek scoring", () => {
  const safeSquares: HideAndSeekSquare[] = ["a1", "a2", "a3", "a4"];

  it("awards 1,000 for a perfect immediate search", () => {
    expect(calculateHideAndSeekScore({
      safeSquares,
      selectedSquares: safeSquares,
      elapsedMs: 0
    })).toMatchObject({
      score: 1_000,
      totalSafe: 4,
      correctCount: 4,
      wrongCount: 0,
      foundPercent: 100
    });
  });

  it("makes speed worth up to 40% while preserving an accuracy gate", () => {
    expect(calculateHideAndSeekScore({ safeSquares, selectedSquares: safeSquares, elapsedMs: 60_000 }).score).toBe(800);
    expect(calculateHideAndSeekScore({ safeSquares, selectedSquares: safeSquares, elapsedMs: 120_000 }).score).toBe(600);
    expect(calculateHideAndSeekScore({ safeSquares, selectedSquares: safeSquares, elapsedMs: 600_000 }).score).toBe(600);
    expect(calculateHideAndSeekScore({ safeSquares, selectedSquares: [], elapsedMs: 0 }).score).toBe(0);
  });

  it("uses the full 60-second clock as the Time Trial speed window", () => {
    expect(calculateHideAndSeekScore({ safeSquares, selectedSquares: safeSquares, elapsedMs: 0, mode: "time_trial" }).score).toBe(1_000);
    expect(calculateHideAndSeekScore({ safeSquares, selectedSquares: safeSquares, elapsedMs: 30_000, mode: "time_trial" }).score).toBe(800);
    expect(calculateHideAndSeekScore({ safeSquares, selectedSquares: safeSquares, elapsedMs: 60_000, mode: "time_trial" }).score).toBe(600);
  });

  it("penalizes missed safe squares and wrong guesses using the exact formula", () => {
    const missed = calculateHideAndSeekScore({
      safeSquares,
      selectedSquares: ["a1", "a2"],
      elapsedMs: 0
    });
    expect(missed.score).toBe(500);
    expect(missed.foundPercent).toBe(50);

    const wrong = calculateHideAndSeekScore({
      safeSquares,
      selectedSquares: ["a1", "a2", "a3", "a4", "h8"],
      elapsedMs: 0
    });
    expect(wrong.score).toBe(800);

    const mixed = calculateHideAndSeekScore({
      safeSquares: ["a1", "a2", "a3"],
      selectedSquares: ["a1", "a2", "h8"],
      elapsedMs: 30_000
    });
    expect(mixed.score).toBe(450);
    expect(mixed.foundPercent).toBe(66.7);
  });

  it("returns sorted correct, wrong, and missed classifications", () => {
    expect(calculateHideAndSeekScore({
      safeSquares: ["h8", "a1", "d4"],
      selectedSquares: ["g7", "h8", "b2"],
      elapsedMs: 42_000
    })).toMatchObject({
      correctSquares: ["h8"],
      wrongSquares: ["b2", "g7"],
      missedSquares: ["a1", "d4"],
      correctCount: 1,
      wrongCount: 2
    });
  });

  it("scores an empty submission as zero and does not count duplicate marks twice", () => {
    expect(calculateHideAndSeekScore({
      safeSquares,
      selectedSquares: [],
      elapsedMs: 10_000
    }).score).toBe(0);

    expect(calculateHideAndSeekScore({
      safeSquares,
      selectedSquares: ["a1", "a1", "h8", "h8"],
      elapsedMs: 0
    })).toMatchObject({
      correctCount: 1,
      wrongCount: 1,
      score: 200
    });
  });

  it("clamps invalid negative time and the final score to its public bounds", () => {
    const result = calculateHideAndSeekScore({
      safeSquares: ["a1"],
      selectedSquares: ["a1"],
      elapsedMs: -5
    });
    expect(result.elapsedMs).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1_000);
    expect(result.score).toBe(1_000);
  });
});
