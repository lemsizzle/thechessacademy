import { describe, expect, it } from "vitest";
import { mergeQuestProgress } from "@/lib/quests/mergeQuestProgress";
import { mergeLichessQuestProgress } from "@/lib/quests/mergeQuestTracking";
import { questProgressIdentity } from "@/lib/quests/questProgressIdentity";
import type { LichessQuestProgress, Quest } from "@/lib/types";

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
});
