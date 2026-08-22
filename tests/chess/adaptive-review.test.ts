import { describe, expect, it } from "vitest";
import { adaptiveReviewDelayMs, nextAdaptiveReviewSchedule, type AdaptiveReviewSchedule } from "@/chess/training/adaptiveReview";

describe("adaptive mistake review", () => {
  it("graduates a position through widening review intervals", () => {
    let schedule: AdaptiveReviewSchedule = { repetitions: 0, intervalDays: 0, status: "learning", lapses: 0 };
    schedule = nextAdaptiveReviewSchedule(schedule, "correct");
    expect(schedule).toMatchObject({ repetitions: 1, intervalDays: 1, status: "review" });
    schedule = nextAdaptiveReviewSchedule(schedule, "correct");
    expect(schedule.intervalDays).toBe(3);
    schedule = nextAdaptiveReviewSchedule(schedule, "correct");
    expect(schedule.intervalDays).toBe(7);
    schedule = nextAdaptiveReviewSchedule(schedule, "correct");
    expect(schedule).toMatchObject({ repetitions: 4, intervalDays: 14, status: "mastered" });
  });

  it("returns missed and revealed positions to learning", () => {
    const current = { repetitions: 4, intervalDays: 14, status: "mastered" as const, lapses: 1 };
    expect(nextAdaptiveReviewSchedule(current, "incorrect")).toEqual({
      repetitions: 0, intervalDays: 0, status: "learning", lapses: 2
    });
    expect(adaptiveReviewDelayMs("incorrect", 0)).toBe(10 * 60 * 1000);
    expect(adaptiveReviewDelayMs("revealed", 0)).toBe(24 * 60 * 60 * 1000);
  });
});
