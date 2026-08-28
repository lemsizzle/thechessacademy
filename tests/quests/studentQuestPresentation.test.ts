import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LichessQuestProgressCard } from "@/components/quests/LichessQuestProgressCard";
import { selectStartedQuests, type QuestLifecycleState } from "@/lib/quests/selectQuestProgress";
import type { Quest, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";

const quest: Quest = {
  id: "quest-complete",
  title: "Complete This Quest",
  description: "Finish the challenge.",
  type: "weekly",
  status: "available",
  isLive: true,
  xpReward: 100,
  source: "internal_puzzles",
  conditionType: "internal_puzzle_solved_count",
  timeWindow: "weekly",
  requiredCount: 20
};

const attempt: StudentQuestAttempt = {
  id: "attempt-complete",
  studentId: "student-1",
  questId: quest.id,
  startedAt: "2026-08-28T10:00:00.000Z",
  expiresAt: "2026-09-04T10:00:00.000Z",
  status: "completed",
  createdAt: "2026-08-28T10:00:00.000Z"
};

const completion: QuestCompletionEvent = {
  id: "completion-1",
  studentId: "student-1",
  questId: quest.id,
  awardId: "award-1",
  completedAt: "2026-08-28T11:00:00.000Z",
  source: "internal_puzzles",
  sourcePeriodStart: attempt.startedAt,
  sourcePeriodEnd: attempt.expiresAt,
  xpAwarded: 80,
  evidence: "Quest completed."
};

describe("student quest presentation", () => {
  it("keeps active and completed quest attempts in Started Quests", () => {
    const quests = [
      { id: "active" },
      { id: "completed" },
      { id: "available" }
    ];
    const lifecycleById = new Map<string, { state: QuestLifecycleState }>([
      ["active", { state: "active" }],
      ["completed", { state: "completed" }],
      ["available", { state: "available" }]
    ]);

    expect(selectStartedQuests(quests, lifecycleById).map((item) => item.id))
      .toEqual(["active", "completed"]);
  });

  it("shows the happy completion face and actual XP and coins earned", () => {
    const html = renderToStaticMarkup(createElement(LichessQuestProgressCard, {
      quest,
      attempt,
      completion,
      now: new Date("2026-08-28T12:00:00.000Z").getTime()
    }));

    expect(html).toContain('aria-label="Quest completed successfully"');
    expect(html).toContain("☺");
    expect(html).toContain("Completed");
    expect(html).toContain("80 XP earned");
    expect(html).toContain("80 coins earned");
    expect(html).not.toContain(">Start</button>");
    expect(html).not.toContain(" left");
  });
});
