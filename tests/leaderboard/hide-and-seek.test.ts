import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { students } from "@/data/students";
import {
  getHideAndSeekLeaderboardScore,
  hasHideAndSeekLeaderboardScore,
  type HideAndSeekLeaderboardScore
} from "@/lib/leaderboard/hideAndSeek";

const mocks = vi.hoisted(() => ({ getSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.getSupabaseServiceClient }));

const score: HideAndSeekLeaderboardScore = {
  studentId: "student-a",
  weekScore: 820,
  monthScore: 905,
  allTimeScore: 972,
  weekAttempts: 2,
  monthAttempts: 4,
  allTimeAttempts: 7
};

describe("Hide and Seek leaderboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects best points for each teacher time window", () => {
    expect(getHideAndSeekLeaderboardScore(score, "week")).toBe(820);
    expect(getHideAndSeekLeaderboardScore(score, "month")).toBe(905);
    expect(getHideAndSeekLeaderboardScore(score, "all")).toBe(972);
    expect(hasHideAndSeekLeaderboardScore(score, "week")).toBe(true);
    expect(hasHideAndSeekLeaderboardScore(undefined, "all")).toBe(false);
  });

  it("treats a zero score as a result only when an attempt exists in that window", () => {
    const zeroScore = {
      ...score,
      weekScore: 0,
      monthScore: 0,
      allTimeScore: 0,
      weekAttempts: 0,
      monthAttempts: 1,
      allTimeAttempts: 1
    };

    expect(hasHideAndSeekLeaderboardScore(zeroScore, "week")).toBe(false);
    expect(hasHideAndSeekLeaderboardScore(zeroScore, "month")).toBe(true);
    expect(hasHideAndSeekLeaderboardScore(zeroScore, "all")).toBe(true);
  });

  it("loads and bounds service-role RPC results", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        student_id: "student-a",
        week_score: "820",
        month_score: "905",
        all_time_score: "1200",
        week_attempts: "2",
        month_attempts: "4",
        all_time_attempts: "7"
      }],
      error: null
    });
    mocks.getSupabaseServiceClient.mockReturnValue({ rpc });
    const { getHideAndSeekLeaderboardScores } = await import("@/lib/leaderboard/hideAndSeekServer");

    await expect(getHideAndSeekLeaderboardScores()).resolves.toEqual([{
      studentId: "student-a",
      weekScore: 820,
      monthScore: 905,
      allTimeScore: 1_000,
      weekAttempts: 2,
      monthAttempts: 4,
      allTimeAttempts: 7
    }]);
    expect(rpc).toHaveBeenCalledWith("get_hide_and_seek_leaderboard");
  });

  it("renders the teacher-only focus with points and no theme control", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardTable, {
      students: students.slice(0, 2),
      lichessAccounts: [],
      survivalScores: [],
      hideAndSeekScores: [{ ...score, studentId: "stu-001" }, {
        studentId: "stu-002",
        weekScore: 760,
        monthScore: 850,
        allTimeScore: 910,
        weekAttempts: 1,
        monthAttempts: 3,
        allTimeAttempts: 5
      }],
      badges: [],
      initialFocus: "Hide and Seek",
      linkMode: "admin"
    }));

    expect(html).toContain("Best Hide and Seek Score");
    expect(html).toContain("972 points");
    expect(html).toContain("Hide and Seek");
    expect(html).not.toContain(">Theme<");
  });

  it("renders a legitimate zero-point attempt in the teacher standings", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardTable, {
      students: students.slice(0, 1),
      lichessAccounts: [],
      survivalScores: [],
      hideAndSeekScores: [{
        studentId: "stu-001",
        weekScore: 0,
        monthScore: 0,
        allTimeScore: 0,
        weekAttempts: 1,
        monthAttempts: 1,
        allTimeAttempts: 1
      }],
      badges: [],
      initialFocus: "Hide and Seek",
      linkMode: "admin"
    }));

    expect(html).toContain("0 points");
    expect(html).not.toContain("No Hide and Seek attempts found");
  });

  it("explains an empty Hide and Seek class and time selection", () => {
    const html = renderToStaticMarkup(createElement(LeaderboardTable, {
      students: students.slice(0, 2),
      lichessAccounts: [],
      survivalScores: [],
      hideAndSeekScores: [],
      badges: [],
      initialFocus: "Hide and Seek",
      linkMode: "admin"
    }));

    expect(html).toContain("No Hide and Seek attempts found");
    expect(html).toContain("No saved attempts match this class and time period yet.");
  });
});
