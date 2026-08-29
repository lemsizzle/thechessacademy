import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { students } from "@/data/students";
import {
  getStarWarsLeaderboardScore,
  hasStarWarsLeaderboardScore,
  type StarWarsLeaderboardScore
} from "@/lib/leaderboard/starWars";

const mocks = vi.hoisted(() => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.getSupabaseServiceClient }));

const score: StarWarsLeaderboardScore = {
  studentId: "student-a",
  weekScore: 8,
  monthScore: 13,
  allTimeScore: 21
};

describe("Star Wars leaderboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects and detects scores for each time window", () => {
    expect(getStarWarsLeaderboardScore(score, "week")).toBe(8);
    expect(getStarWarsLeaderboardScore(score, "month")).toBe(13);
    expect(getStarWarsLeaderboardScore(score, "all")).toBe(21);
    expect(hasStarWarsLeaderboardScore(score, "week")).toBe(true);
    expect(hasStarWarsLeaderboardScore({ ...score, weekScore: 0 }, "week")).toBe(false);
    expect(hasStarWarsLeaderboardScore(undefined, "all")).toBe(false);
  });

  it("loads and bounds service-role RPC results", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        student_id: "student-a",
        week_score: "8",
        month_score: "13",
        all_time_score: "900"
      }],
      error: null
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { getStarWarsLeaderboardScores } = await import("@/lib/leaderboard/starWarsServer");

    await expect(getStarWarsLeaderboardScores()).resolves.toEqual([{
      studentId: "student-a",
      weekScore: 8,
      monthScore: 13,
      allTimeScore: 500
    }]);
    expect(rpc).toHaveBeenCalledWith("get_star_wars_leaderboard");
  });

  it("renders verified runs as points and excludes students without a score", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardTable, {
      students: students.slice(0, 2),
      lichessAccounts: [],
      survivalScores: [],
      starWarsScores: [{ ...score, studentId: "stu-001" }],
      badges: [],
      initialFocus: "Star Wars"
    }));

    expect(html).toContain("Best Star Wars Run");
    expect(html).toContain("21 points");
    expect(html).toContain(students[0].name);
    expect(html).not.toContain(students[1].name);
  });

  it("explains an empty Star Wars class and time selection", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardTable, {
      students: students.slice(0, 2),
      lichessAccounts: [],
      survivalScores: [],
      starWarsScores: [],
      badges: [],
      initialFocus: "Star Wars"
    }));

    expect(html).toContain("No Star Wars scores found");
    expect(html).toContain("No verified runs match this class and time period yet.");
  });
});
