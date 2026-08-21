import { describe, expect, it } from "vitest";
import { evaluateInternalGameQuest, evaluateInternalPuzzleQuest, type InternalQuestGameActivity, type InternalQuestPuzzleActivity } from "@/lib/quests/evaluateInternalQuest";
import { getConditionsForSource, isAutomatedQuestSource } from "@/lib/quests/questOptions";
import { getSafeQuestLink } from "@/lib/quests/questLinks";
import type { Quest } from "@/lib/types";

const window = {
  start: new Date("2026-08-01T00:00:00.000Z"),
  end: new Date("2026-08-08T00:00:00.000Z"),
  label: "the started quest window"
};

function quest(patch: Partial<Quest>): Quest {
  return {
    id: "academy-quest",
    title: "Academy challenge",
    description: "Use saved in-app activity.",
    type: "weekly",
    status: "in-progress",
    isLive: true,
    xpReward: 100,
    source: "internal_games",
    conditionType: "internal_games_played_count",
    timeWindow: "weekly",
    requiredCount: 1,
    isActive: true,
    ...patch
  };
}

const games: InternalQuestGameActivity[] = [
  { id: "g1", completedAt: "2026-08-02T00:00:00.000Z", opponentType: "computer", result: "win" },
  { id: "g2", completedAt: "2026-08-03T00:00:00.000Z", opponentType: "computer", result: "loss" },
  { id: "g3", completedAt: "2026-08-04T00:00:00.000Z", opponentType: "student", result: "win" },
  { id: "g4", completedAt: "2026-08-05T00:00:00.000Z", opponentType: "student", result: "draw" }
];

const puzzles: InternalQuestPuzzleActivity[] = [
  { id: "p1", attemptedAt: "2026-08-02T00:00:00.000Z", solved: true, firstTryCorrect: true, selectedTheme: "mixed", themes: ["fork"] },
  { id: "p2", attemptedAt: "2026-08-03T00:00:00.000Z", solved: true, firstTryCorrect: false, selectedTheme: "pin", themes: ["pin"] },
  { id: "p3", attemptedAt: "2026-08-04T00:00:00.000Z", solved: false, firstTryCorrect: false, selectedTheme: "fork", themes: ["fork"] }
];

describe("internal quest activity", () => {
  it("counts all, computer, live, and winning Academy games independently", () => {
    expect(evaluateInternalGameQuest("student", quest({ requiredCount: 4 }), window, games).currentValue).toBe(4);
    expect(evaluateInternalGameQuest("student", quest({ conditionType: "internal_computer_games_won_count" }), window, games).currentValue).toBe(1);
    const liveWins = evaluateInternalGameQuest("student", quest({ conditionType: "internal_live_games_won_count", requiredCount: 1 }), window, games);
    expect(liveWins.currentValue).toBe(1);
    expect(liveWins.completed).toBe(true);
  });

  it("counts solved, first-try, themed, and accuracy puzzle goals", () => {
    expect(evaluateInternalPuzzleQuest("student", quest({ source: "internal_puzzles", conditionType: "internal_puzzle_solved_count" }), window, puzzles).currentValue).toBe(2);
    expect(evaluateInternalPuzzleQuest("student", quest({ source: "internal_puzzles", conditionType: "internal_puzzle_first_try_count" }), window, puzzles).currentValue).toBe(1);
    expect(evaluateInternalPuzzleQuest("student", quest({ source: "internal_puzzles", conditionType: "internal_puzzle_theme_solved_count", requiredTheme: "Fork" }), window, puzzles).currentValue).toBe(1);
    const accuracy = evaluateInternalPuzzleQuest("student", quest({ source: "internal_puzzles", conditionType: "internal_puzzle_accuracy_threshold", requiredCount: 3, requiredAccuracy: 60 }), window, puzzles);
    expect(accuracy.accuracy).toBe(67);
    expect(accuracy.completed).toBe(true);
  });

  it("exposes both Academy sources as automated teacher options", () => {
    expect(isAutomatedQuestSource("internal_games")).toBe(true);
    expect(isAutomatedQuestSource("internal_puzzles")).toBe(true);
    expect(getConditionsForSource("internal_games").map((item) => item.value)).toContain("internal_live_games_won_count");
    expect(getConditionsForSource("internal_puzzles").map((item) => item.value)).toContain("internal_puzzle_accuracy_threshold");
  });

  it("allows safe student routes for Academy quest links", () => {
    expect(getSafeQuestLink("/student/play")).toEqual({ href: "/student/play", external: false });
    expect(getSafeQuestLink("/student/training")).toEqual({ href: "/student/training", external: false });
    expect(getSafeQuestLink("/admin/quests")).toBeNull();
    expect(getSafeQuestLink("javascript:alert(1)")).toBeNull();
  });
});
