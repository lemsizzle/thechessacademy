import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PuzzleModeSetup } from "@/components/training/PuzzleModeSetup";

function renderSetup() {
  return renderToStaticMarkup(createElement(PuzzleModeSetup, {
    selectedTheme: "mixed",
    onThemeChange: vi.fn(),
    selectedLevel: "all",
    onLevelChange: vi.fn(),
    woodpeckerSetSize: 20,
    onWoodpeckerSetSizeChange: vi.fn(),
    autoAdvance: false,
    onAutoAdvanceChange: vi.fn(),
    onStart: vi.fn(),
    overview: {
      overall: { attempts: 0, solved: 0, accuracy: 0, elapsedSeconds: 0 },
      daily: { completed: 0, xpEarned: 0, coinsEarned: 0, latestCompletedAt: null },
      survival: { allTimeScore: 29, monthScore: 12, weekScore: 5 },
      survivalByTheme: [],
      latestWoodpeckerCycle: null,
      woodpecker: { completedCycles: 0, completedSets: 0, recentCycles: [], recentSets: [] },
      hideAndSeek: {
        attempts: 0,
        personalBest: 0,
        averageFoundPercent: 0,
        averageWrongCount: 0,
        averageElapsedMs: 0,
        latestAttemptAt: null
      }
    }
  }));
}

describe("puzzle mode setup", () => {
  it("offers direct starts and separate optional settings without an introductory dialog", () => {
    const html = renderSetup();

    expect(html).not.toContain('role="dialog"');
    // The mode chooser must allow the persistent navigation to remain usable.
    expect(html).toContain('aria-label="Survival settings"');
    expect(html).toContain("Choose a puzzle mode");
    expect(html).toContain("Survival");
    expect(html).toContain("Woodpecker Method");
    expect(html).toContain("Puzzle of the Day");
    expect(html).toContain("Path Finder");
    expect(html).toContain("Hide and Seek");
    expect(html).toContain("Learn From Your Mistakes");
    expect(html).toContain("Games + Survival · spaced review");
    expect(html).toContain("View My Stats");
    expect(html).not.toContain("Begin with very easy puzzles and climb through five difficulty stages.");
    expect(html).not.toContain("Turn mistakes from analyzed games and Survival training into personal puzzles.");
    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Start Survival"');
    expect(html).toContain('aria-label="Launch Path Finder"');
    expect(html).toContain('aria-label="Start Hide and Seek"');
    expect(html).not.toContain("Recorded performance");
    expect(html).not.toContain("Survival leaderboard");
  });
});
