import { describe, expect, it } from "vitest";
import { canCreateQuestAward } from "@/lib/quests/questDuplicatePrevention";
import type { Quest, QuestCompletionEvent } from "@/lib/types";

const repeatableQuest: Quest = {
  id: "rapid-warrior",
  title: "Rapid Warrior",
  description: "Win rated rapid games.",
  type: "weekly",
  status: "available",
  xpReward: 150,
  source: "lichess_games",
  conditionType: "rapid_win_count",
  timeWindow: "daily",
  requiredCount: 5,
  isRepeatable: true,
  cooldownDays: 1
};

const priorCompletion: QuestCompletionEvent = {
  id: "completion-old",
  studentId: "student-1",
  questId: repeatableQuest.id,
  awardId: "award-old",
  completedAt: "2026-08-10T12:15:00.000Z",
  source: "lichess_games",
  sourcePeriodStart: "2026-08-10T12:00:00.000Z",
  sourcePeriodEnd: "2026-08-11T12:00:00.000Z",
  xpAwarded: repeatableQuest.xpReward,
  evidence: "Completed."
};

describe("quest award duplicate prevention", () => {
  it("unlocks a repeatable quest reward at the prior attempt expiry", () => {
    expect(canCreateQuestAward(
      "student-1",
      repeatableQuest,
      priorCompletion.sourcePeriodEnd,
      [],
      [priorCompletion]
    )).toBe(true);
  });

  it("does not unlock another reward before the prior attempt expires", () => {
    expect(canCreateQuestAward(
      "student-1",
      repeatableQuest,
      "2026-08-11T11:59:59.999Z",
      [],
      [priorCompletion]
    )).toBe(false);
  });
});
