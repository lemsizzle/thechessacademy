import { describe, expect, it } from "vitest";
import { getDailyChessQuote } from "@/lib/student/dailyChessQuote";

describe("getDailyChessQuote", () => {
  it("returns the same quote throughout one UTC day", () => {
    expect(getDailyChessQuote(new Date("2026-08-28T00:00:00.000Z"))).toBe(
      getDailyChessQuote(new Date("2026-08-28T23:59:59.999Z"))
    );
  });

  it("moves to a different quote on the next UTC day", () => {
    expect(getDailyChessQuote(new Date("2026-08-28T23:59:59.999Z"))).not.toBe(
      getDailyChessQuote(new Date("2026-08-29T00:00:00.000Z"))
    );
  });
});
