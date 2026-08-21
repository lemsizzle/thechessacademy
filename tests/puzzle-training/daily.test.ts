import { describe, expect, it } from "vitest";
import { academyPuzzleDate, dailyPuzzlePivot } from "../../lib/puzzle-training/daily";

describe("Puzzle of the Day", () => {
  it("uses the Academy's Bangkok calendar day", () => {
    expect(academyPuzzleDate(new Date("2026-08-21T17:30:00.000Z"))).toBe("2026-08-22");
  });

  it("maps a date to a stable database pivot", () => {
    const first = dailyPuzzlePivot("2026-08-22");
    expect(first).toBe(dailyPuzzlePivot("2026-08-22"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(first).not.toBe(dailyPuzzlePivot("2026-08-23"));
  });
});
