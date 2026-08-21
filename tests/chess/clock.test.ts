import { describe, expect, it } from "vitest";
import { clockAt, completeClockMove, createClockSnapshot, expiredClockColor, formatClock } from "@/chess/game/clock";

describe("reusable chess clock", () => {
  it("uses timestamps and adds increment after a completed move", () => {
    const clock = { whiteMs: 10_000, blackMs: 10_000, activeColor: "white" as const, startedAt: 1_000 };
    expect(clockAt(clock, 3_000)).toEqual({ whiteMs: 8_000, blackMs: 10_000, activeColor: "white" });
    expect(completeClockMove(clock, "white", 5_000, 3_000)).toEqual({
      whiteMs: 13_000,
      blackMs: 10_000,
      activeColor: "black",
      startedAt: 3_000
    });
  });

  it("detects timeout and clamps the display to zero", () => {
    const snapshot = clockAt({ whiteMs: 1_000, blackMs: 5_000, activeColor: "white", startedAt: 2_000 }, 3_500);
    expect(snapshot.whiteMs).toBe(0);
    expect(expiredClockColor(snapshot)).toBe("white");
    expect(formatClock(snapshot.whiteMs)).toBe("0:00.0");
    expect(() => completeClockMove({ whiteMs: 1_000, blackMs: 5_000, activeColor: "white", startedAt: 2_000 }, "white", 5_000, 3_500)).toThrow("expired");
  });

  it("disables clock state for no-clock games", () => {
    expect(createClockSnapshot({ id: "none", name: "No Clock", initialMs: null, incrementMs: 0 })).toBeNull();
  });
});
