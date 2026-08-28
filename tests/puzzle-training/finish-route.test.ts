import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { forkPuzzle } from "@/tests/fixtures/lichessPuzzles";

const serverMocks = vi.hoisted(() => ({
  getTrainingPuzzle: vi.fn(),
  requirePuzzleSessionStudent: vi.fn(),
  requirePuzzleStudent: vi.fn(),
  saveTrainingAttempt: vi.fn()
}));

vi.mock("@/lib/puzzle-training/server", () => serverMocks);

import { POST } from "@/app/api/student/puzzle-training/finish/route";

const studentId = "20000000-0000-4000-8000-000000000002";
const sessionId = "30000000-0000-4000-8000-000000000003";
const woodpeckerRunId = "40000000-0000-4000-8000-000000000004";

describe("puzzle finish route Woodpecker metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
    serverMocks.requirePuzzleSessionStudent.mockResolvedValue({ studentId });
    serverMocks.requirePuzzleStudent.mockResolvedValue({ studentId });
    serverMocks.saveTrainingAttempt.mockResolvedValue({ elapsedSeconds: 5, firstTryCorrect: false });
  });

  it("persists run metadata from the signed token", async () => {
    const startedAt = new Date();
    const token = createPuzzleSessionToken({
      version: 2,
      puzzleId: forkPuzzle.id,
      studentId,
      sessionId,
      selectedTheme: "mixed",
      trainingMode: "woodpecker",
      woodpeckerRunId,
      woodpeckerCycleNumber: 3,
      nextMoveIndex: 1,
      startedAt: startedAt.toISOString(),
      expiresAt: new Date(startedAt.getTime() + (60 * 60 * 1000)).toISOString(),
      incorrectMoveCount: 1,
      hintsUsed: 0,
      puzzle: {
        id: forkPuzzle.id,
        initial_fen: forkPuzzle.initial_fen,
        moves: forkPuzzle.moves,
        start_mode: forkPuzzle.start_mode,
        accepted_moves: forkPuzzle.accepted_moves,
        themes: forkPuzzle.themes,
        rating: forkPuzzle.rating,
        game_url: forkPuzzle.game_url
      }
    });
    const request = new NextRequest("http://localhost/api/student/puzzle-training/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(serverMocks.saveTrainingAttempt).toHaveBeenCalledWith(expect.objectContaining({
      studentId,
      puzzleId: forkPuzzle.id,
      sessionId,
      trainingMode: "woodpecker",
      woodpeckerRunId,
      woodpeckerCycleNumber: 3,
      solved: false
    }));
  });
});
