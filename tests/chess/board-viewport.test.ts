import { describe, expect, it } from "vitest";
import { boardViewportHeight } from "@/chess/components/boardViewportSize";

describe("board viewport sizing", () => {
  it("keeps the same height budget when a split-screen scrollbar appears and disappears", () => {
    const noScrollbar = boardViewportHeight(1080, 1080, 1080);
    // At 140% zoom the scrollbar caused an 11px width oscillation every frame.
    const scrollbar = boardViewportHeight(1080, 1069.0476, 1069);
    expect(Math.floor(scrollbar)).toBe(noScrollbar);
    expect(boardViewportHeight(1080, 1065, 1065)).toBe(noScrollbar);
    expect(boardViewportHeight(1080, 1068.8, 1069)).toBe(noScrollbar);
  });

  it("still fits the visible area when a mobile keyboard or browser controls reduce it", () => {
    expect(boardViewportHeight(844, 500, 844)).toBe(500);
    expect(boardViewportHeight(844, 485, 829)).toBe(500);
  });

  it("uses the layout viewport when visual viewport information is unavailable", () => {
    expect(boardViewportHeight(800, undefined, 785)).toBe(800);
    expect(boardViewportHeight(800, 800.01, 800)).toBe(800);
  });
});
