import { describe, expect, it } from "vitest";
import { getSurvivalLeaderboardScore, type SurvivalLeaderboardScore } from "@/lib/leaderboard/survival";

const score: SurvivalLeaderboardScore = {
  studentId: "student-a",
  weekScore: 8,
  monthScore: 17,
  allTimeScore: 32
};

describe("survival puzzle leaderboard", () => {
  it("selects each student's best run for the active time window", () => {
    expect(getSurvivalLeaderboardScore(score, "week")).toBe(8);
    expect(getSurvivalLeaderboardScore(score, "month")).toBe(17);
    expect(getSurvivalLeaderboardScore(score, "all")).toBe(32);
  });

  it("gives students without a survival run a zero score", () => {
    expect(getSurvivalLeaderboardScore(undefined, "all")).toBe(0);
  });
});
