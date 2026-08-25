import { describe, expect, it } from "vitest";
import { hasCoachPresence } from "@/chess/live/presence";

describe("live game coach presence", () => {
  it("finds a coach among other channel subscribers", () => {
    expect(hasCoachPresence({
      player: [{ role: "student" }],
      teacher: [{ role: "coach", onlineAt: "2026-08-26T00:00:00.000Z" }]
    })).toBe(true);
  });

  it("does not treat ordinary subscribers as coaches", () => {
    expect(hasCoachPresence({
      white: [{ role: "student" }],
      black: [{ role: "student" }]
    })).toBe(false);
  });
});
