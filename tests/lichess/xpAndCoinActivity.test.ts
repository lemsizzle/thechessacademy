import { describe, expect, it } from "vitest";
import { getLichessXpBreakdown } from "@/lib/lichessXp";
import { buildStudentActivityItems } from "@/lib/studentActivity";
import type { Student, StudentLichessAccount } from "@/lib/types";

const student: Student = {
  id: "student-1",
  slug: "student-1",
  name: "Student One",
  avatar: "S",
  classGroup: "Test Class",
  totalXp: 0,
  badgeIds: [],
  completedQuestIds: [],
  encouragement: "Keep going."
};

const account: StudentLichessAccount = {
  id: "account-1",
  studentId: student.id,
  lichessUserId: "studentone",
  lichessUsername: "StudentOne",
  lichessProfileUrl: "https://lichess.org/@/StudentOne",
  blitzRating: 1500,
  blitzGames: 0,
  blitzRatingChange: 0,
  blitzRatingDeviation: null,
  blitzProvisional: true,
  rapidRating: 795,
  rapidGames: 6,
  rapidRatingChange: 0,
  rapidRatingDeviation: null,
  rapidProvisional: true,
  puzzleRating: null,
  puzzleGames: 0,
  rapidWins: 0,
  baselineRapidGames: 0,
  baselineRapidWins: 0,
  baselineBlitzGames: 0,
  baselinePuzzleGames: 0,
  linkedAt: "2026-07-19T16:07:43.956Z",
  activityBaselineSetAt: "2026-07-19T16:07:43.956Z",
  syncStatus: "connected",
  createdAt: "2026-07-19T16:07:43.956Z",
  updatedAt: "2026-07-19T17:00:00.000Z"
};

describe("Lichess XP and coin activity", () => {
  it("awards played-game XP from the persisted first-login baseline", () => {
    const xp = getLichessXpBreakdown(account);
    expect(xp.rapidGamesAfterLogin).toBe(6);
    expect(xp.rapidWinsAfterLogin).toBe(0);
    expect(xp.rapidGameXp).toBe(30);
    expect(xp.total).toBe(30);
  });

  it("shows store spending in the shared student activity feed", () => {
    const items = buildStudentActivityItems({
      student,
      badges: [],
      lichessAccount: account,
      coinTransactions: [{
        id: "purchase-1",
        studentId: student.id,
        amount: -25,
        transactionType: "spend",
        sourceType: "avatar_purchase",
        sourceId: "hair-1",
        description: "Purchased avatar item: Tousled Hair",
        idempotencyKey: "purchase-1",
        createdAt: "2026-07-19T17:10:00.000Z"
      }]
    });

    expect(items[0]).toMatchObject({
      kind: "coin",
      title: "Academy Coins spent",
      amount: -25
    });
    expect(items[0]?.detail).toContain("Tousled Hair");
  });
});
