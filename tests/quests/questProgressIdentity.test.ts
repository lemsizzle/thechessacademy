import { describe, expect, it } from "vitest";
import { mergeQuestProgress } from "@/lib/quests/mergeQuestProgress";
import { mergeLichessQuestProgress, mergeQuestAttempts } from "@/lib/quests/mergeQuestTracking";
import { questProgressIdentity } from "@/lib/quests/questProgressIdentity";
import { isQuestCompletionCurrent, newestByDate, selectQuestLifecycle, selectQuestTrackingForAttempt } from "@/lib/quests/selectQuestProgress";
import type { LichessQuestProgress, Quest, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";

const quest: Quest = {
  id: "pin-grind",
  title: "Pin Grind",
  description: "Solve pin puzzles.",
  type: "weekly",
  status: "available",
  xpReward: 80,
  source: "lichess_puzzles",
  conditionType: "puzzle_theme_solved_count",
  timeWindow: "weekly",
  requiredCount: 30,
  requiredTheme: "Pin"
};

function progress(currentValue: number, start: string, end: string): LichessQuestProgress {
  return {
    studentId: "student-1",
    questId: quest.id,
    sourcePeriodStart: start,
    sourcePeriodEnd: end,
    currentValue,
    requiredValue: 30,
    completed: false,
    evidence: `${currentValue} pins`,
    mode: "connected",
    updatedAt: "2026-07-22T12:30:00.000Z"
  };
}

describe("quest progress period identity", () => {
  it("treats equivalent timestamptz formats as the same progress period", () => {
    const zulu = progress(2, "2026-07-22T12:00:00.000Z", "2026-07-29T12:00:00.000Z");
    const offset = progress(4, "2026-07-22 12:00:00+00", "2026-07-29 12:00:00+00");

    expect(questProgressIdentity(zulu)).toBe(questProgressIdentity(offset));
    expect(mergeQuestProgress([zulu], [offset], [quest])).toHaveLength(1);
    expect(mergeLichessQuestProgress([zulu], [offset])).toHaveLength(1);
    expect(mergeLichessQuestProgress([zulu], [offset])[0]?.currentValue).toBe(4);
  });

  it("keeps a repaired server countdown over an older browser copy", () => {
    const serverAttempt = {
      id: "attempt-1",
      studentId: "student-1",
      questId: quest.id,
      startedAt: "2026-07-22T12:00:00.000Z",
      expiresAt: "2026-07-29T12:00:00.000Z",
      status: "active" as const,
      createdAt: "2026-07-22T12:00:00.000Z"
    };
    const staleBrowserAttempt = {
      ...serverAttempt,
      expiresAt: "2026-07-23T12:00:00.000Z"
    };

    expect(mergeQuestAttempts([serverAttempt], [staleBrowserAttempt]))
      .toEqual([serverAttempt]);
  });

  it("does not attach an expired completion to a restarted quest attempt", () => {
    const oldAttempt: StudentQuestAttempt = {
      id: "attempt-old",
      studentId: "student-1",
      questId: quest.id,
      startedAt: "2026-08-03T12:00:00.000Z",
      expiresAt: "2026-08-10T12:00:00.000Z",
      status: "completed",
      createdAt: "2026-08-03T12:00:00.000Z"
    };
    const restartedAttempt: StudentQuestAttempt = {
      ...oldAttempt,
      id: "attempt-restarted",
      startedAt: "2026-08-11T12:00:00.000Z",
      expiresAt: "2026-08-18T12:00:00.000Z",
      status: "active",
      createdAt: "2026-08-11T12:00:00.000Z"
    };
    const oldCompletion: QuestCompletionEvent = {
      id: "completion-old",
      studentId: "student-1",
      questId: quest.id,
      awardId: "award-old",
      completedAt: "2026-08-04T12:00:00.000Z",
      source: "lichess_puzzles",
      sourcePeriodStart: oldAttempt.startedAt,
      sourcePeriodEnd: oldAttempt.expiresAt,
      xpAwarded: quest.xpReward,
      evidence: "Old attempt completed."
    };

    const tracking = selectQuestTrackingForAttempt({
      quest,
      attempt: restartedAttempt,
      completions: [oldCompletion],
      awards: [],
      progress: []
    });

    expect(tracking.completion).toBeUndefined();
    expect(tracking.award).toBeUndefined();
    expect(tracking.progress).toBeUndefined();

    expect(selectQuestLifecycle({
      studentId: "student-1",
      quest,
      attempts: [oldAttempt, restartedAttempt],
      completions: [oldCompletion],
      now: new Date("2026-08-12T12:00:00.000Z").getTime()
    })).toEqual({ state: "active", attempt: restartedAttempt });
  });

  it("makes a completed repeatable quest available as soon as its attempt timer expires", () => {
    const attempt: StudentQuestAttempt = {
      id: "attempt-completed",
      studentId: "student-1",
      questId: quest.id,
      startedAt: "2026-08-03T12:00:00.000Z",
      expiresAt: "2026-08-10T12:00:00.000Z",
      status: "completed",
      createdAt: "2026-08-03T12:00:00.000Z"
    };
    const completion: QuestCompletionEvent = {
      id: "completion-current",
      studentId: "student-1",
      questId: quest.id,
      awardId: "award-current",
      completedAt: "2026-08-04T12:00:00.000Z",
      source: "lichess_puzzles",
      sourcePeriodStart: attempt.startedAt,
      sourcePeriodEnd: attempt.expiresAt,
      xpAwarded: quest.xpReward,
      evidence: "Quest completed."
    };

    expect(isQuestCompletionCurrent({
      studentId: "student-1",
      questId: quest.id,
      attempts: [attempt],
      completions: [completion],
      now: new Date("2026-08-10T11:59:59.999Z").getTime()
    })).toBe(true);
    expect(isQuestCompletionCurrent({
      studentId: "student-1",
      questId: quest.id,
      attempts: [attempt],
      completions: [completion],
      now: new Date(attempt.expiresAt).getTime()
    })).toBe(false);

    expect(selectQuestLifecycle({
      studentId: "student-1",
      quest,
      attempts: [attempt],
      completions: [completion],
      now: new Date(attempt.expiresAt).getTime()
    })).toEqual({ state: "available" });
  });

  it("compares equivalent ISO timestamp formats by instant", () => {
    const older = { id: "older", at: "2026-08-10T13:00:00.000+07:00" };
    const newer = { id: "newer", at: "2026-08-10T07:30:00.000Z" };

    expect(newestByDate([older, newer], (item) => item.at)).toBe(newer);
  });
});
