import { describe, expect, it } from "vitest";
import { crossedOneMinuteWarning } from "@/chess/game/clockWarning";

describe("one-minute clock warning", () => {
  it("fires only when a running clock crosses one minute", () => {
    expect(crossedOneMinuteWarning(60_100, 60_000)).toBe(true);
    expect(crossedOneMinuteWarning(60_000, 59_900)).toBe(false);
    expect(crossedOneMinuteWarning(null, 59_000)).toBe(false);
    expect(crossedOneMinuteWarning(100, 0)).toBe(false);
  });
});
