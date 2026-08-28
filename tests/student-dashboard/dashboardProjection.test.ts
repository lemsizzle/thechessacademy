import { describe, expect, it } from "vitest";
import {
  buildStudentDashboardProgress,
  loadOptionalDashboardSection,
  summarizeStudentDashboardQuests
} from "@/lib/student/dashboardProjection";
import type {
  LichessQuestProgress,
  Quest,
  QuestCompletionEvent,
  Student,
  StudentLichessAccount,
  StudentQuestAttempt
} from "@/lib/types";

const student: Student = {
  id: "student-a",
  slug: "student-a",
  name: "Student A",
  avatar: "S",
  classGroup: "Monday",
  totalXp: 500,
  badgeIds: [],
  encouragement: "Keep going."
};

const lichessAccount = {
  studentId: student.id,
  blitzRating: 1_000,
  blitzGames: 0,
  blitzWins: 0,
  blitzProvisional: false,
  rapidRating: 1_000,
  rapidGames: 5,
  rapidWins: 2,
  rapidProvisional: false,
  puzzleRating: 1_000,
  puzzleGames: 0,
  puzzleCorrect: 0,
  baselineBlitzRating: 1_000,
  baselineRapidRating: 1_000,
  baselinePuzzleRating: 1_000,
  baselineBlitzGames: 0,
  baselineRapidGames: 3,
  baselinePuzzleGames: 0,
  baselineBlitzWins: 0,
  baselineRapidWins: 1,
  baselinePuzzleCorrect: 0
} as StudentLichessAccount;

function quest(id: string, title: string, isLive = true): Quest {
  return {
    id,
    title,
    description: title,
    type: "weekly",
    status: "available",
    isLive,
    xpReward: 25,
    isActive: true
  };
}

function attempt(
  id: string,
  questId: string,
  startedAt: string,
  expiresAt: string,
  status: StudentQuestAttempt["status"] = "active"
): StudentQuestAttempt {
  return { id, studentId: student.id, questId, startedAt, expiresAt, status, createdAt: startedAt };
}

describe("student dashboard projection", () => {
  it("uses canonical Academy plus Lichess XP for level progress", () => {
    expect(buildStudentDashboardProgress(student, lichessAccount)).toEqual({
      lifetimeXp: 515,
      level: 3,
      title: "Bishop Adept",
      currentLevelXp: 240,
      nextLevelXp: 275,
      neededXp: 35,
      percent: 87,
      isMaxLevel: false
    });
  });

  it("counts current quest lifecycle states and selects the soonest active progress", () => {
    const now = Date.parse("2026-08-28T12:00:00.000Z");
    const firstAttempt = attempt(
      "attempt-first",
      "first",
      "2026-08-28T10:00:00.000Z",
      "2026-08-29T10:00:00.000Z"
    );
    const attempts = [
      firstAttempt,
      attempt("attempt-later", "later", "2026-08-28T10:00:00.000Z", "2026-08-30T10:00:00.000Z"),
      attempt("attempt-done", "done", "2026-08-28T09:00:00.000Z", "2026-08-31T09:00:00.000Z", "completed"),
      attempt("attempt-expired", "expired", "2026-08-20T09:00:00.000Z", "2026-08-21T09:00:00.000Z", "completed")
    ];
    const progress: LichessQuestProgress[] = [{
      studentId: student.id,
      questId: "first",
      sourcePeriodStart: firstAttempt.startedAt,
      sourcePeriodEnd: firstAttempt.expiresAt,
      currentValue: 4,
      requiredValue: 10,
      accuracy: 80,
      completed: false,
      evidence: "4 counted",
      mode: "connected",
      updatedAt: "2026-08-28T11:00:00.000Z"
    }];

    const completions: QuestCompletionEvent[] = [
      {
        id: "completion-done",
        studentId: student.id,
        questId: "done",
        awardId: "award-done",
        completedAt: "2026-08-28T11:30:00.000Z",
        source: "internal_puzzles",
        sourcePeriodStart: "2026-08-28T09:00:00.000Z",
        sourcePeriodEnd: "2026-08-31T09:00:00.000Z",
        xpAwarded: 25,
        evidence: "completed"
      },
      {
        id: "completion-expired",
        studentId: student.id,
        questId: "expired",
        awardId: "award-expired",
        completedAt: "2026-08-20T11:30:00.000Z",
        source: "internal_puzzles",
        sourcePeriodStart: "2026-08-20T09:00:00.000Z",
        sourcePeriodEnd: "2026-08-21T09:00:00.000Z",
        xpAwarded: 25,
        evidence: "completed"
      },
      {
        id: "another-student-completion",
        studentId: "student-b",
        questId: "first",
        awardId: "another-award",
        completedAt: "2026-08-28T11:45:00.000Z",
        source: "internal_puzzles",
        sourcePeriodStart: firstAttempt.startedAt,
        sourcePeriodEnd: firstAttempt.expiresAt,
        xpAwarded: 25,
        evidence: "completed"
      }
    ];

    expect(summarizeStudentDashboardQuests({
      studentId: student.id,
      quests: [quest("first", "First Quest"), quest("later", "Later Quest"), quest("done", "Done Quest"), quest("expired", "Old Quest", false)],
      attempts,
      progress,
      completions,
      now
    })).toEqual({
      activeCount: 2,
      completedCount: 2,
      soonestExpiring: {
        id: "first",
        title: "First Quest",
        expiresAt: firstAttempt.expiresAt,
        progress: {
          currentValue: 4,
          requiredValue: 10,
          accuracy: 80,
          completed: false
        }
      }
    });
  });

  it("isolates rejected optional sections behind their declared fallback", async () => {
    const fallback = { attempts: 0 };
    await expect(loadOptionalDashboardSection(
      async () => { throw new Error("training unavailable"); },
      fallback
    )).resolves.toEqual({ value: fallback, available: false });

    await expect(loadOptionalDashboardSection(
      async () => ({ attempts: 12 }),
      fallback
    )).resolves.toEqual({ value: { attempts: 12 }, available: true });
  });
});
