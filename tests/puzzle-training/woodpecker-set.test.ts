import { describe, expect, it } from "vitest";
import { validateCompletedWoodpeckerSet, type SavedWoodpeckerSetAttempt } from "@/lib/puzzle-training/woodpeckerSet";

const sessions = ["cycle-1", "cycle-2", "cycle-3"];
const runId = "run-1";

function completedAttempts(puzzleCount = 20): SavedWoodpeckerSetAttempt[] {
  return sessions.flatMap((sessionId, cycleIndex) => Array.from({ length: puzzleCount }, (_, puzzleIndex) => {
    const completedAt = new Date(Date.UTC(2026, 7, 1, cycleIndex, puzzleIndex));
    return {
      puzzle_id: `puzzle-${String(puzzleIndex + 1).padStart(2, "0")}`,
      session_id: sessionId,
      solved: true,
      selected_theme: "fork",
      attempted_at: new Date(completedAt.getTime() - 30_000).toISOString(),
      completed_at: completedAt.toISOString(),
      woodpecker_run_id: runId,
      woodpecker_cycle_number: cycleIndex + 1
    };
  }));
}

describe("Woodpecker full-set verification", () => {
  it("accepts three matching cycles of exactly 20 solved puzzles", () => {
    const result = validateCompletedWoodpeckerSet(runId, sessions, completedAttempts());

    expect(result).toMatchObject({ cycleCount: 3, setSize: 20, selectedTheme: "fork" });
    expect(result.puzzleIds).toHaveLength(20);
    expect(result.startedAt).toBe("2026-07-31T23:59:30.000Z");
    expect(result.completedAt).toBe("2026-08-01T02:19:00.000Z");
  });

  it("rejects duplicate cycles, incomplete cycles, and unsolved puzzles", () => {
    expect(() => validateCompletedWoodpeckerSet(runId, [sessions[0], sessions[0], sessions[2]], completedAttempts())).toThrow(/distinct cycles/i);
    expect(() => validateCompletedWoodpeckerSet(runId, sessions, completedAttempts(19))).toThrow(/exactly 20 solved/i);

    const attempts = completedAttempts();
    attempts[0].solved = false;
    expect(() => validateCompletedWoodpeckerSet(runId, sessions, attempts)).toThrow(/exactly 20 solved/i);
  });

  it("rejects cycles that do not repeat the same puzzle set and theme", () => {
    const mismatchedPuzzles = completedAttempts();
    mismatchedPuzzles.find((attempt) => attempt.session_id === sessions[2])!.puzzle_id = "different-puzzle";
    expect(() => validateCompletedWoodpeckerSet(runId, sessions, mismatchedPuzzles)).toThrow(/same 20-puzzle set/i);

    const mismatchedTheme = completedAttempts();
    for (const attempt of mismatchedTheme.filter((item) => item.session_id === sessions[2])) attempt.selected_theme = "pin";
    expect(() => validateCompletedWoodpeckerSet(runId, sessions, mismatchedTheme)).toThrow(/same theme/i);
  });

  it("rejects recombined runs, wrong cycle bindings, and invalid timing", () => {
    const wrongRun = completedAttempts();
    wrongRun[0].woodpecker_run_id = "another-run";
    expect(() => validateCompletedWoodpeckerSet(runId, sessions, wrongRun)).toThrow(/exactly 20 solved/i);

    const wrongCycle = completedAttempts();
    wrongCycle[0].woodpecker_cycle_number = 2;
    expect(() => validateCompletedWoodpeckerSet(runId, sessions, wrongCycle)).toThrow(/exactly 20 solved/i);

    const invalidTime = completedAttempts();
    invalidTime[0].attempted_at = "not-a-date";
    expect(() => validateCompletedWoodpeckerSet(runId, sessions, invalidTime)).toThrow(/valid training time/i);
  });
});
