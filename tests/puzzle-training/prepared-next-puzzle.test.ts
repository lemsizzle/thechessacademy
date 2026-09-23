import { beforeEach, describe, expect, it } from "vitest";
import { readPreparedNextPuzzle, activatePreparedNextPuzzle } from "@/lib/puzzle-training/preparedNextPuzzle";
import { createPuzzleSessionToken, readPuzzleSessionToken, type OpaquePuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { forkPuzzle, pinPuzzle } from "@/tests/fixtures/lichessPuzzles";

function payload(): OpaquePuzzleSessionToken {
  return { version: 2, puzzleId: forkPuzzle.id, studentId: "20000000-0000-4000-8000-000000000002", sessionId: "30000000-0000-4000-8000-000000000003", selectedTheme: "mixed", trainingMode: "survival", nextMoveIndex: 1, startedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString(), incorrectMoveCount: 0, hintsUsed: 0, puzzle: forkPuzzle };
}
describe("prepared puzzle handoff", () => {
  beforeEach(() => { process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters"; });
  it.each([
    { studentId: "20000000-0000-4000-8000-000000000099" },
    { sessionId: "30000000-0000-4000-8000-000000000099" },
    { selectedTheme: "pin" as const }, { trainingMode: "woodpecker" as const },
    { incorrectMoveCount: 1 }, { hintsUsed: 1 }, { nextMoveIndex: 2 }, { dailyDate: "2026-09-23" }
  ])("discards an incompatible or already-used preparation: %j", patch => {
    const current = payload();
    const token = createPuzzleSessionToken({ ...current, puzzleId: pinPuzzle.id, puzzle: pinPuzzle, ...patch });
    expect(readPreparedNextPuzzle(token, current, "improver")).toBeNull();
  });
  it("rejects a wrong difficulty, exact target, current puzzle, or tampered token", () => {
    const current = payload();
    const token = createPuzzleSessionToken({ ...current, puzzleId: pinPuzzle.id, puzzle: pinPuzzle });
    expect(readPreparedNextPuzzle(token, current, "beginner")).toBeNull();
    expect(readPreparedNextPuzzle(token, current, "all", forkPuzzle.id)).toBeNull();
    expect(readPreparedNextPuzzle(createPuzzleSessionToken(current), current, "all")).toBeNull();
    expect(readPreparedNextPuzzle("bad-token", current, "all")).toBeNull();
    expect(readPreparedNextPuzzle(token, current, "all")?.puzzleId).toBe(pinPuzzle.id);
    const expiring = createPuzzleSessionToken({ ...current, puzzleId: pinPuzzle.id, puzzle: pinPuzzle, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    expect(readPreparedNextPuzzle(expiring, current, "all")).toBeNull();
  });
  it("refreshes start time without extending authorization", () => {
    const current = payload();
    const next = { ...current, puzzleId: pinPuzzle.id, puzzle: pinPuzzle, expiresAt: new Date(Date.now() + 720_000).toISOString() };
    const activated = readPuzzleSessionToken(activatePreparedNextPuzzle(next, current).token);
    expect(activated).toMatchObject({ expiresAt: current.expiresAt });
    expect(Date.parse(activated.startedAt)).toBeGreaterThan(Date.parse(next.startedAt));
  });
});
