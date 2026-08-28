import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WoodpeckerCycleSummary } from "@/components/training/WoodpeckerCycleSummary";
import type { WoodpeckerCycleResult } from "@/lib/puzzle-training/modes";

function renderSummary(result: Partial<WoodpeckerCycleResult> = {}) {
  return renderToStaticMarkup(createElement(WoodpeckerCycleSummary, {
    result: {
      cycle: 2,
      puzzlesSolved: 20,
      incorrectMoves: 1,
      elapsedSeconds: 107,
      puzzlesPerMinute: 11.2,
      accuracy: 95,
      mistakePuzzleIds: ["mistake-1"],
      reviewed: false,
      ...result
    },
    saveState: "saved",
    onReviewMistakes: vi.fn(),
    onRetrySave: vi.fn(),
    onContinue: vi.fn(),
    onReturnToTraining: vi.fn()
  }));
}

describe("Woodpecker cycle results popup", () => {
  it("shows cycle stats in an accessible popup with the requested actions", () => {
    const html = renderSummary();

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Your cycle stats");
    expect(html).toContain("Puzzles/min");
    expect(html).toContain("11.2");
    expect(html).toContain("Accuracy");
    expect(html).toContain("95%");
    expect(html).toContain("Next Cycle");
    expect(html).toContain("min-h-14 flex-1");
    expect(html).toContain("Review Mistakes");
    expect(html).toContain("Return to Training");
  });

  it("uses a final action instead of offering a nonexistent fourth cycle", () => {
    const html = renderSummary({ cycle: 3, mistakePuzzleIds: [] });

    expect(html).toContain("Finish Training");
    expect(html).not.toContain("Next Cycle");
    expect(html).not.toContain("Review Mistakes</button>");
    expect(html).toContain("Return to Training");
  });
});
