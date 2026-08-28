import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WoodpeckerCycleSummary } from "@/components/training/WoodpeckerCycleSummary";
import type { WoodpeckerCycleResult } from "@/lib/puzzle-training/modes";

function renderSummary(
  result: Partial<WoodpeckerCycleResult> = {},
  save: {
    state?: "idle" | "saving" | "saved" | "error";
    delayed?: boolean;
    error?: string;
  } = {}
) {
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
    saveState: save.state ?? "saved",
    saveDelayed: save.delayed ?? false,
    saveError: save.error,
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

  it("keeps a slow verification neutral and does not offer an unnecessary retry", () => {
    const html = renderSummary({}, { state: "saving", delayed: true });

    expect(html).toContain("Verification is taking a little longer.");
    expect(html).toContain("Your completed cycle is still being saved. You do not need to retry.");
    expect(html).not.toContain("Retry Save");
    expect(html).not.toContain("needs another try");
  });

  it("offers retry only after verification actually fails", () => {
    const html = renderSummary({}, { state: "error", error: "The verification service did not respond." });

    expect(html).toContain("Cycle verification needs another try.");
    expect(html).toContain("The verification service did not respond.");
    expect(html).toContain("Retry Save");
  });
});
