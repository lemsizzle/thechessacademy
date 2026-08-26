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

  it("awards 2 XP and 2 coins for each correct puzzle after login", () => {
    const xp = getLichessXpBreakdown({
      ...account,
      rapidGames: 0,
      puzzleGames: 4,
      puzzleCorrect: 3,
      baselinePuzzleGames: 0,
      baselinePuzzleCorrect: 0
    });

    expect(xp.puzzleCorrectAfterLogin).toBe(3);
    expect(xp.puzzleActivityXp).toBe(6);
    expect(xp.total).toBe(6);
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

  it("shows the durable incremental Lichess reward instead of cumulative activity as a new award", () => {
    const items = buildStudentActivityItems({
      student,
      badges: [],
      lichessAccount: account,
      coinTransactions: [{
        id: "lichess-reward-1",
        studentId: student.id,
        amount: 12,
        transactionType: "earn",
        sourceType: "lichess_xp",
        sourceId: "v2:30",
        description: "Academy Coins earned from cumulative Lichess XP.",
        idempotencyKey: "lichess-reward-1",
        createdAt: "2026-07-19T17:10:00.000Z"
      }]
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "xp",
      title: "Lichess XP and coins earned",
      detail: "+12 XP and +12 coins.",
      amount: 12
    });
  });

  it("shows Academy puzzle XP and its mirrored coins as one puzzle activity", () => {
    const items = buildStudentActivityItems({
      student,
      badges: [],
      xpEvents: [{
        id: "academy-puzzle-1",
        studentId: student.id,
        amount: 2,
        reason: "Academy puzzle solved (Survival).",
        createdAt: "2026-08-26T09:00:00.000Z"
      }]
    });

    expect(items[0]).toMatchObject({
      kind: "puzzle",
      title: "Academy puzzle solved",
      detail: "+2 XP and +2 coins - Academy puzzle solved (Survival).",
      amount: 2
    });
  });

  it("shows Academy game XP and its mirrored coins as one game activity", () => {
    const items = buildStudentActivityItems({
      student,
      badges: [],
      xpEvents: [{
        id: "academy-game-1",
        studentId: student.id,
        amount: 10,
        reason: "Academy rapid game win.",
        createdAt: "2026-08-26T09:05:00.000Z"
      }]
    });

    expect(items[0]).toMatchObject({
      kind: "game",
      title: "Academy game completed",
      detail: "+10 XP and +10 coins - Academy rapid game win.",
      amount: 10
    });
  });

  it("shows the daily puzzle reward as puzzle activity with matching coins", () => {
    const items = buildStudentActivityItems({
      student,
      badges: [],
      xpEvents: [{
        id: "daily-puzzle-1",
        studentId: student.id,
        amount: 10,
        reason: "Puzzle of the Day — 2026-08-26",
        createdAt: "2026-08-26T09:10:00.000Z"
      }]
    });

    expect(items[0]).toMatchObject({
      kind: "puzzle",
      title: "Puzzle of the Day solved",
      detail: "+10 XP and +10 coins - Puzzle of the Day — 2026-08-26",
      amount: 10
    });
  });
});
