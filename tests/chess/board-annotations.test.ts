import { describe, expect, it } from "vitest";
import {
  annotationColorForModifiers,
  annotationStyleForColor,
  annotationStyleForModifiers,
  BOARD_ANNOTATION_COLORS,
  shouldClearBoardAnnotations,
  toggleBoardArrow,
  toggleBoardCircle
} from "@/chess/components/boardAnnotations";

describe("Lichess-style board annotations", () => {
  it("maps the four Lichess modifier brushes", () => {
    expect(annotationStyleForModifiers({})).toBe("primary");
    expect(annotationStyleForModifiers({ shiftKey: true })).toBe("danger");
    expect(annotationStyleForModifiers({ ctrlKey: true })).toBe("danger");
    expect(annotationStyleForModifiers({ altKey: true })).toBe("secondary");
    expect(annotationStyleForModifiers({ metaKey: true })).toBe("secondary");
    expect(annotationStyleForModifiers({ shiftKey: true, altKey: true })).toBe("warning");
  });

  it("round-trips semantic styles through rendered colors", () => {
    for (const [style, color] of Object.entries(BOARD_ANNOTATION_COLORS)) {
      expect(annotationStyleForColor(color)).toBe(style);
    }
    expect(annotationColorForModifiers({ ctrlKey: true })).toBe(BOARD_ANNOTATION_COLORS.danger);
  });

  it("clears annotations only for a primary mouse click outside the board", () => {
    expect(shouldClearBoardAnnotations(0, false)).toBe(true);
    expect(shouldClearBoardAnnotations(0, true)).toBe(false);
    expect(shouldClearBoardAnnotations(1, false)).toBe(false);
    expect(shouldClearBoardAnnotations(2, false)).toBe(false);
  });

  it("adds, removes, and recolors arrows by their exact route", () => {
    const green = { startSquare: "a1", endSquare: "a8", color: BOARD_ANNOTATION_COLORS.primary };
    const red = { ...green, color: BOARD_ANNOTATION_COLORS.danger };
    const second = { startSquare: "b1", endSquare: "c3", color: BOARD_ANNOTATION_COLORS.primary };

    expect(toggleBoardArrow([], green)).toEqual([green]);
    expect(toggleBoardArrow([green, second], green)).toEqual([second]);
    expect(toggleBoardArrow([green, second], red)).toEqual([red, second]);
  });

  it("adds, removes, and recolors circles by square", () => {
    const green = { square: "e4", color: BOARD_ANNOTATION_COLORS.primary };
    const blue = { ...green, color: BOARD_ANNOTATION_COLORS.secondary };
    const second = { square: "d5", color: BOARD_ANNOTATION_COLORS.primary };

    expect(toggleBoardCircle([], green)).toEqual([green]);
    expect(toggleBoardCircle([green, second], green)).toEqual([second]);
    expect(toggleBoardCircle([green, second], blue)).toEqual([blue, second]);
  });
});
