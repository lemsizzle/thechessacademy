import { describe, expect, it } from "vitest";
import { BOARD_INTERACTION_OPTIONS, BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";

describe("shared chessboard feel", () => {
  it("keeps programmatic moves visible without making the board feel delayed", () => {
    expect(BOARD_MOTION_OPTIONS.showAnimations).toBe(true);
    expect(BOARD_MOTION_OPTIONS.animationDurationInMs).toBeGreaterThanOrEqual(80);
    expect(BOARD_MOTION_OPTIONS.animationDurationInMs).toBeLessThanOrEqual(120);
  });

  it("starts deliberate drags quickly without moving or scrolling the page", () => {
    expect(BOARD_INTERACTION_OPTIONS.dragActivationDistance).toBeGreaterThan(0);
    expect(BOARD_INTERACTION_OPTIONS.dragActivationDistance).toBeLessThanOrEqual(4);
    expect(BOARD_INTERACTION_OPTIONS.allowDragOffBoard).toBe(false);
    expect(BOARD_INTERACTION_OPTIONS.allowAutoScroll).toBe(false);
  });
});
