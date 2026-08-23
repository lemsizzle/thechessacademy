import { describe, expect, it } from "vitest";
import { BOARD_INTERACTION_OPTIONS, BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";

describe("chessboard motion", () => {
  it("keeps programmatic moves visible without making the board feel delayed", () => {
    expect(BOARD_MOTION_OPTIONS.showAnimations).toBe(true);
    expect(BOARD_MOTION_OPTIONS.animationDurationInMs).toBeGreaterThanOrEqual(80);
    expect(BOARD_MOTION_OPTIONS.animationDurationInMs).toBeLessThanOrEqual(150);
  });

  it("requires a deliberate drag before picking up a piece", () => {
    expect(BOARD_INTERACTION_OPTIONS.dragActivationDistance).toBeGreaterThanOrEqual(8);
    expect(BOARD_INTERACTION_OPTIONS.allowDragOffBoard).toBe(false);
    expect(BOARD_INTERACTION_OPTIONS.allowAutoScroll).toBe(false);
  });
});
