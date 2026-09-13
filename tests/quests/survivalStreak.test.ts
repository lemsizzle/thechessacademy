import { describe, expect, it } from "vitest";
import { evaluateInternalPuzzleQuest, type InternalQuestPuzzleActivity } from "@/lib/quests/evaluateInternalQuest";
import { createPendingQuestAwards } from "@/lib/quests/createPendingQuestAward";
import { getConditionsForSource } from "@/lib/quests/questOptions";
import type { Quest } from "@/lib/types";

const quest: Quest = {
  id: "academy-puzzle-streaker", title: "Puzzle Streaker", description: "Reach a 15-puzzle streak in Survival mode.",
  type: "boss", status: "available", isLive: true, isActive: true, xpReward: 150,
  source: "internal_puzzles", conditionType: "internal_survival_streak_reached", requiredCount: 15,
  timeWindow: "all_time", isRepeatable: false, approvalRequired: false
};
const window = { start: new Date("2026-09-01"), end: new Date("2026-09-30"), label: "this quest" };
function run(count: number, sessionId = "run-a"): InternalQuestPuzzleActivity[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${sessionId}-${i}`, sessionId, trainingMode: "survival", incorrectMoveCount: 0,
    attemptedAt: new Date(Date.parse("2026-09-13") + i * 60000).toISOString(),
    solved: true, firstTryCorrect: true, selectedTheme: "mixed", themes: []
  }));
}
const evaluate = (attempts: InternalQuestPuzzleActivity[], error?: string) => evaluateInternalPuzzleQuest("student", quest, window, attempts, error);

describe("Puzzle Streaker", () => {
  it("requires 15, awards 150 XP, and prevents duplicate awards", () => {
    expect(evaluate(run(14)).completed).toBe(false);
    const progress = evaluate(run(15));
    expect(progress).toMatchObject({ currentValue: 15, requiredValue: 15, completed: true });
    const awards = createPendingQuestAwards("student", [quest], [progress], [], []);
    expect(awards).toHaveLength(1);
    expect(awards[0].xpAmount).toBe(150);
    expect(createPendingQuestAwards("student", [quest], [progress], awards, [])).toHaveLength(0);
  });
  it("never combines separate runs", () => {
    expect(evaluate([...run(8), ...run(7, "run-b")])).toMatchObject({ currentValue: 8, completed: false });
  });
  it("resets on a wrong move, then starts at one when that puzzle is solved", () => {
    const attempts = run(29);
    attempts[14].incorrectMoveCount = 1;
    expect(evaluate(attempts.slice(0, 28))).toMatchObject({ currentValue: 14, completed: false });
    expect(evaluate(attempts)).toMatchObject({ currentValue: 15, completed: true });
  });
  it("resets on a failed puzzle and preserves an earlier best", () => {
    const attempts = run(20);
    attempts[15].solved = false;
    expect(evaluate(attempts).currentValue).toBe(15);
    attempts[7].solved = false;
    expect(evaluate(attempts).currentValue).toBe(7);
  });
  it("ignores other modes, missing run identifiers and out-of-window activity", () => {
    expect(evaluate(run(15).map(a => ({ ...a, trainingMode: "woodpecker" }))).currentValue).toBe(0);
    expect(evaluate(run(15).map(a => ({ ...a, sessionId: undefined }))).currentValue).toBe(0);
    expect(evaluate(run(15).map(a => ({ ...a, attemptedAt: "2026-08-31" }))).currentValue).toBe(0);
    expect(evaluate(run(15).map(a => ({ ...a, completedAt: "2026-10-01" }))).currentValue).toBe(0);
  });
  it("orders attempts, ignores duplicates, and matches the game's hint behavior", () => {
    const attempts = run(15).map(a => ({ ...a, firstTryCorrect: false }));
    expect(evaluate([...attempts].reverse()).completed).toBe(true);
    expect(evaluate([...run(14), run(14)[0]]).completed).toBe(false);
    expect(evaluate(attempts, "read failed").completed).toBe(false);
    expect(getConditionsForSource("internal_puzzles").some(c => c.value === quest.conditionType)).toBe(true);
  });
});
