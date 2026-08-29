import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PuzzleTrainingStatsSummary } from "@/components/training/PuzzleTrainingStats";
import { emptyPuzzleTrainingOverview, type PuzzleTrainingOverview } from "@/lib/puzzle-training/overview";

const overview: PuzzleTrainingOverview = {
  overall: { attempts: 83, solved: 67, accuracy: 81, elapsedSeconds: 7_501 },
  daily: {
    completed: 12,
    xpEarned: 120,
    coinsEarned: 120,
    latestCompletedAt: "2026-08-28T03:00:00.000Z"
  },
  survival: { allTimeScore: 29, monthScore: 24, weekScore: 17 },
  survivalByTheme: [
    { theme: "mixed", allTimeScore: 29, monthScore: 24, weekScore: 17 },
    { theme: "fork", allTimeScore: 21, monthScore: 18, weekScore: 11 },
    { theme: "pin", allTimeScore: 15, monthScore: 9, weekScore: 0 }
  ],
  latestWoodpeckerCycle: {
    setSize: 20,
    puzzlesPerMinute: 8.5,
    accuracy: 95,
    theme: "mixed",
    completedAt: "2026-08-27T04:00:00.000Z"
  },
  woodpecker: {
    completedCycles: 5,
    completedSets: 1,
    recentCycles: [
      {
        cycleNumber: 3,
        setSize: 20,
        puzzlesPerMinute: 8.5,
        accuracy: 95,
        theme: "fork",
        completedAt: "2026-08-27T04:00:00.000Z"
      },
      {
        cycleNumber: null,
        setSize: 30,
        puzzlesPerMinute: 6,
        accuracy: 90,
        theme: "pin",
        completedAt: "2026-08-26T04:00:00.000Z"
      }
    ],
    recentSets: [{
      setSize: 20,
      cycleCount: 3,
      theme: "fork",
      startedAt: "2026-08-26T03:00:00.000Z",
      completedAt: "2026-08-27T04:00:00.000Z"
    }]
  },
  hideAndSeek: {
    attempts: 9,
    personalBest: 948,
    averageFoundPercent: 84.6,
    averageWrongCount: 1.2,
    averageElapsedMs: 41_500,
    latestAttemptAt: "2026-08-28T05:00:00.000Z"
  }
};

function renderStats(value = overview) {
  return renderToStaticMarkup(createElement(PuzzleTrainingStatsSummary, {
    adaptiveReviewStats: createElement("div", null, "Adaptive review summary"),
    leaderboard: createElement("div", null, "Theme leaderboard controls"),
    overview: value,
    starWarsBestScore: 14
  }));
}

describe("puzzle training stats", () => {
  it("shows overall and daily totals with durable reward history", () => {
    const html = renderStats();

    expect(html).toContain("Overall progress");
    expect(html).toContain("83");
    expect(html).toContain("67");
    expect(html).toContain("81%");
    expect(html).toContain("2h 5m");
    expect(html).toContain("Daily rewards");
    expect(html).toContain("Days completed");
    expect(html).toContain("120");
    expect(html).toContain("Aug 28, 2026");
  });

  it("shows the student's Survival records for every recorded theme", () => {
    const html = renderStats();

    expect(html).toContain("Personal records by theme");
    expect(html).toContain("Mixed themes");
    expect(html).toContain("Fork");
    expect(html).toContain("Pin");
    expect(html).toContain("All time");
    expect(html).toContain("30 days");
    expect(html).toContain("7 days");
    expect((html.match(/Mixed themes/g) ?? [])).toHaveLength(1);
  });

  it("shows recent Woodpecker cycles and completed full sets", () => {
    const html = renderStats();

    expect(html).toContain("Training history");
    expect(html).toContain("Recent cycles");
    expect(html).toContain("Recent full sets");
    expect(html).toContain("8.5");
    expect(html).toContain("95%");
    expect(html).toContain("20 puzzles × 3 cycles");
    expect(html).toContain("#3");
    expect(html).toContain("Aug 27, 2026");
  });

  it("shows durable Hide and Seek records", () => {
    const html = renderStats();

    expect(html).toContain("Board-vision records");
    expect(html).toContain("948 pts");
    expect(html).toContain("84.6%");
    expect(html).toContain("42s");
    expect(html).toContain("Saved to your student account");
  });

  it("keeps browser-only and adaptive stats clearly separated from server records", () => {
    const html = renderStats();

    expect(html).toContain("Star Wars");
    expect(html).toContain("Best score");
    expect(html).toContain("14");
    expect(html).toContain("Saved on this browser");
    expect(html).toContain("Adaptive review summary");
    expect(html).toContain("Survival leaderboard");
    expect(html).toContain("Theme leaderboard controls");
  });

  it("uses useful empty states before the first recorded session", () => {
    const html = renderStats(emptyPuzzleTrainingOverview);

    expect(html).toContain("No record yet");
    expect(html).toContain("Finish a Woodpecker cycle to start your speed and accuracy history.");
    expect(html).toContain("Complete every cycle in a set to record it here.");
    expect(html).toContain("Mixed themes");
  });
});
