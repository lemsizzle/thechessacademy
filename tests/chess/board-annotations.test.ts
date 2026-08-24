import { describe, expect, it } from "vitest";
import { annotationColorForModifiers, annotationStyleForColor, annotationStyleForModifiers, BOARD_ANNOTATION_COLORS, shouldClearBoardAnnotations } from "@/chess/components/boardAnnotations";

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
});
