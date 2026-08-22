import { describe, expect, it } from "vitest";
import { BOARD_MOTION_OPTIONS } from "@/chess/components/boardMotion";

describe("chessboard motion", () => {
  it("keeps programmatic moves visible without making the board feel delayed", () => {
    expect(BOARD_MOTION_OPTIONS.showAnimations).toBe(true);
    expect(BOARD_MOTION_OPTIONS.animationDurationInMs).toBeGreaterThanOrEqual(80);
    expect(BOARD_MOTION_OPTIONS.animationDurationInMs).toBeLessThanOrEqual(150);
  });
});
