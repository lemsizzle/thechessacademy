import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PublicTrainingPuzzle } from "@/lib/puzzle-training/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/chess/components/AcademyChessboard", () => ({ AcademyChessboard: () => <div role="grid" aria-label="Replay board" /> }));
vi.mock("@/chess/components/BoardViewport", () => ({ BoardViewport: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/chess/components/BoardSettings", () => ({ BoardSettings: () => null }));
vi.mock("@/chess/components/PromotionDialog", () => ({ PromotionDialog: () => null }));
import { PuzzleReplay } from "@/components/training/PuzzleReplay";

const puzzle: PublicTrainingPuzzle = {
  id: "p1", displayFen: "1r6/4k3/8/4N3/8/8/8/6K1 w - - 1 2", orientation: "white", sideToMove: "White",
  prompt: "", sourceKind: "lichess", token: "opaque", daily: null
};
describe("replay controls", () => {
  it("renders the board immediately with Next and optional auto-advance", () => {
    const html = renderToStaticMarkup(<PuzzleReplay initialPuzzle={puzzle} backHref="/back" nextHref="/next?period=30" />);
    expect(html).toContain('aria-label="Replay board"');
    expect(html).not.toContain("Start replay");
    expect(html).toContain("items-start"); // The tall instructions must not shrink the board.
    expect(html).toContain('aria-label="Next missed puzzle"');
    expect(html).toContain("Auto-advance after solving");
    expect(html).not.toContain('checked=""');
    expect(html).toContain("Skipped puzzles stay in your replay list");
  });

  it("preserves enabled auto-advance on the next puzzle", () => {
    const html = renderToStaticMarkup(<PuzzleReplay initialPuzzle={puzzle} backHref="/back" nextHref="/next?period=30" initialAutoAdvance />);
    expect(html).toContain('checked=""');
  });

  it("disables Next with an explanation at the end of the list", () => {
    const html = renderToStaticMarkup(<PuzzleReplay initialPuzzle={puzzle} backHref="/back" nextHref={null} />);
    expect(html).toMatch(/aria-label="Next missed puzzle" disabled=""/);
    expect(html).toContain("This is the last puzzle in this list");
  });
});
