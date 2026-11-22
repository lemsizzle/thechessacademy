import { afterEach, describe, expect, it, vi } from "vitest";
import { clearQuestRefreshCooldown, reserveQuestRefresh, retryQuestRefreshLater } from "@/lib/student/questRefreshCooldown";

afterEach(() => {
  clearQuestRefreshCooldown("student-a");
  clearQuestRefreshCooldown("student-b");
  vi.unstubAllGlobals();
});

describe("automatic quest refresh cooldown", () => {
  it("prevents duplicate refreshes even when session storage throws", () => {
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("Blocked"); } });
    expect(reserveQuestRefresh("student-a", 1_000_000)).toBe(true);
    expect(reserveQuestRefresh("student-a", 1_000_001)).toBe(false);
    expect(reserveQuestRefresh("student-b", 1_000_001)).toBe(true);
    expect(reserveQuestRefresh("student-a", 1_600_000)).toBe(true);
  });

  it("retries failed checks after thirty seconds and resets on logout", () => {
    expect(reserveQuestRefresh("student-a", 1_000_000)).toBe(true);
    retryQuestRefreshLater("student-a", 1_000_000);
    expect(reserveQuestRefresh("student-a", 1_029_999)).toBe(false);
    expect(reserveQuestRefresh("student-a", 1_030_000)).toBe(true);
    clearQuestRefreshCooldown("student-a");
    expect(reserveQuestRefresh("student-a", 1_030_001)).toBe(true);
  });
});
