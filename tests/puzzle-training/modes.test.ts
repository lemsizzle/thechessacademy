import { describe, expect, it } from "vitest";
import {
  nextWoodpeckerStep,
  PUZZLE_DIFFICULTY_OPTIONS,
  SURVIVAL_PUZZLE_LIMIT,
  survivalDifficultyForPuzzle,
  SURVIVAL_DIFFICULTY_STAGES,
  WOODPECKER_MAX_SET_SIZE,
  WOODPECKER_ROUND_COUNT,
  WOODPECKER_SET_SIZE,
  WOODPECKER_SET_SIZE_OPTIONS
} from "@/lib/puzzle-training/modes";

describe("puzzle training modes", () => {
  it("allows a survival run to reach 50 puzzles", () => {
    expect(SURVIVAL_PUZZLE_LIMIT).toBe(50);
  });

  it("progresses Survival from very easy to expert in ten-puzzle stages", () => {
    expect(SURVIVAL_DIFFICULTY_STAGES).toHaveLength(5);
    expect(survivalDifficultyForPuzzle(1).level).toBe("beginner");
    expect(survivalDifficultyForPuzzle(10).level).toBe("beginner");
    expect(survivalDifficultyForPuzzle(11).level).toBe("improver");
    expect(survivalDifficultyForPuzzle(21).level).toBe("intermediate");
    expect(survivalDifficultyForPuzzle(31).level).toBe("advanced");
    expect(survivalDifficultyForPuzzle(41).level).toBe("expert");
    expect(survivalDifficultyForPuzzle(50).level).toBe("expert");
  });

  it("offers every fixed difficulty in Woodpecker mode", () => {
    expect(PUZZLE_DIFFICULTY_OPTIONS.map((option) => option.id)).toEqual([
      "all",
      "beginner",
      "improver",
      "intermediate",
      "advanced",
      "expert"
    ]);
  });

  it("uses a minimum Woodpecker set size of 20 puzzles", () => {
    expect(WOODPECKER_SET_SIZE).toBe(20);
    expect(WOODPECKER_SET_SIZE_OPTIONS).toEqual([20, 30, 40, 50]);
    expect(WOODPECKER_MAX_SET_SIZE).toBe(50);
    expect(nextWoodpeckerStep(1, 4, WOODPECKER_SET_SIZE)).toEqual({
      round: 1,
      puzzleIndex: 5,
      finished: false
    });
  });

  it("restarts the same set for three rounds before finishing", () => {
    expect(WOODPECKER_ROUND_COUNT).toBe(3);
    expect(nextWoodpeckerStep(1, 19, WOODPECKER_SET_SIZE)).toEqual({
      round: 2,
      puzzleIndex: 0,
      finished: false
    });
    expect(nextWoodpeckerStep(2, 19, WOODPECKER_SET_SIZE)).toEqual({
      round: 3,
      puzzleIndex: 0,
      finished: false
    });
    expect(nextWoodpeckerStep(3, 19, WOODPECKER_SET_SIZE)).toEqual({
      round: 3,
      puzzleIndex: 19,
      finished: true
    });
  });

  it("completes the default set after exactly 60 Woodpecker solves", () => {
    let round = 1;
    let puzzleIndex = 0;
    let puzzleCount = 1;

    while (true) {
      const nextStep = nextWoodpeckerStep(round, puzzleIndex, WOODPECKER_SET_SIZE);
      if (nextStep.finished) break;
      round = nextStep.round;
      puzzleIndex = nextStep.puzzleIndex;
      puzzleCount += 1;
    }

    expect(puzzleCount).toBe(WOODPECKER_SET_SIZE * WOODPECKER_ROUND_COUNT);
  });
});
