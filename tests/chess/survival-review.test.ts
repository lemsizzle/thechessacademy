import { describe, expect, it } from "vitest";
import { buildSurvivalReviewPosition } from "@/chess/training/survivalReview";
import { forkPuzzle, multiMovePuzzle } from "@/tests/fixtures/lichessPuzzles";

describe("Survival mistake review positions", () => {
  it("rebuilds the exact missed position with its private solution", () => {
    const review = buildSurvivalReviewPosition({
      puzzle: forkPuzzle,
      nextMoveIndex: 1,
      attemptedMoveUci: "e5f7",
      attemptedMoveSan: "Nf7"
    });

    expect(review).toMatchObject({
      sourcePly: 2,
      color: "white",
      playedMoveSan: "Nf7",
      playedMoveUci: "e5f7",
      bestMoveUci: "e5c6",
      bestMoveSan: "Nc6+",
      acceptedMovesUci: ["e5c6"]
    });
    expect(review.explanation).toContain("Survival");
  });

  it("can recover a historical miss at the first student move", () => {
    const review = buildSurvivalReviewPosition({
      puzzle: multiMovePuzzle,
      nextMoveIndex: 1
    });

    expect(review.playedMoveUci).toBe("");
    expect(review.bestLineSan).not.toBe("");
    expect(review.bestMoveUci).toBe("a2e6");
  });
});
