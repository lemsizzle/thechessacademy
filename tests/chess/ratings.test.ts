import { describe, expect, it } from "vitest";
import { chessRatingBand, chessRatingChange, expectedChessScore } from "@/chess/rating/rating";

describe("Academy PvP ratings", () => {
  it("uses a symmetric Elo expectation", () => {
    expect(expectedChessScore(1200, 1200)).toBe(0.5);
    expect(expectedChessScore(1400, 1200)).toBeCloseTo(0.76, 2);
    expect(expectedChessScore(1200, 1400) + expectedChessScore(1400, 1200)).toBeCloseTo(1, 8);
  });

  it("uses a larger provisional K factor for the first ten games", () => {
    expect(chessRatingChange(1200, 1200, 1, 0)).toBe(20);
    expect(chessRatingChange(1200, 1200, 0, 9)).toBe(-20);
    expect(chessRatingChange(1200, 1200, 1, 10)).toBe(12);
    expect(chessRatingChange(1200, 1200, 0.5, 10)).toBe(0);
  });

  it("assigns stable student-facing rating bands", () => {
    expect(chessRatingBand(999)).toBe("New Challenger");
    expect(chessRatingBand(1200)).toBe("Club Player");
    expect(chessRatingBand(1800)).toBe("Master Scholar");
  });
});
