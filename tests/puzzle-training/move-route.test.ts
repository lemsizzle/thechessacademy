import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPuzzleSessionToken, readPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { multiMovePuzzle } from "@/tests/fixtures/lichessPuzzles";
import { forkPuzzle } from "@/tests/fixtures/lichessPuzzles";

const serverMocks = vi.hoisted(() => ({
  awardDailyTrainingPuzzle: vi.fn(),
  getTrainingPuzzle: vi.fn(),
  requirePuzzleSessionStudent: vi.fn(),
  requirePuzzleStudent: vi.fn(),
  saveTrainingAttempt: vi.fn(),
  selectTrainingPuzzle: vi.fn()
}));

vi.mock("@/lib/puzzle-training/server", () => serverMocks);

import { POST } from "@/app/api/student/puzzle-training/move/route";

const studentId = "20000000-0000-4000-8000-000000000002";
const sessionId = "30000000-0000-4000-8000-000000000003";

function requestWithToken(token: string, move = { from: "a2", to: "e6" }, extra: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/student/puzzle-training/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, move, ...extra })
  });
}

function basePayload() {
  const startedAt = new Date();
  return {
    puzzleId: multiMovePuzzle.id,
    studentId,
    sessionId,
    selectedTheme: "mixed" as const,
    trainingMode: "woodpecker" as const,
    nextMoveIndex: 1,
    startedAt: startedAt.toISOString(),
    incorrectMoveCount: 0,
    hintsUsed: 0
  };
}

describe("puzzle move route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
    serverMocks.requirePuzzleSessionStudent.mockResolvedValue({ studentId });
    serverMocks.requirePuzzleStudent.mockResolvedValue({ studentId });
    serverMocks.saveTrainingAttempt.mockResolvedValue({ elapsedSeconds: 12, firstTryCorrect: true });
  });

  it("validates an opaque intermediate move without Supabase reads", async () => {
    const payload = basePayload();
    const token = createPuzzleSessionToken({
      ...payload,
      version: 2,
      expiresAt: new Date(Date.now() + (60 * 60 * 1000)).toISOString(),
      puzzle: {
        id: multiMovePuzzle.id,
        initial_fen: multiMovePuzzle.initial_fen,
        moves: multiMovePuzzle.moves,
        start_mode: multiMovePuzzle.start_mode,
        accepted_moves: multiMovePuzzle.accepted_moves,
        themes: multiMovePuzzle.themes,
        rating: multiMovePuzzle.rating,
        game_url: multiMovePuzzle.game_url
      }
    });

    const response = await POST(requestWithToken(token));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ accepted: true, completed: false, opponentMove: "d7d8" });
    expect(serverMocks.requirePuzzleSessionStudent).toHaveBeenCalledOnce();
    expect(serverMocks.requirePuzzleStudent).not.toHaveBeenCalled();
    expect(serverMocks.getTrainingPuzzle).not.toHaveBeenCalled();
    expect(serverMocks.saveTrainingAttempt).not.toHaveBeenCalled();
  });

  it("keeps legacy in-progress sessions working through the database fallback", async () => {
    serverMocks.getTrainingPuzzle.mockResolvedValue(multiMovePuzzle);
    const token = createPuzzleSessionToken({ ...basePayload(), version: 1 });

    const response = await POST(requestWithToken(token));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ accepted: true, completed: false, opponentMove: "d7d8" });
    expect(serverMocks.requirePuzzleStudent).toHaveBeenCalledOnce();
    expect(serverMocks.getTrainingPuzzle).toHaveBeenCalledWith(multiMovePuzzle.id);
    expect(serverMocks.requirePuzzleSessionStudent).not.toHaveBeenCalled();
  });

  it("waits for durable attempt persistence and does not refresh the authorization lease", async () => {
    let releaseSave: ((value: { elapsedSeconds: number; firstTryCorrect: boolean }) => void) | undefined;
    serverMocks.saveTrainingAttempt.mockImplementation(() => new Promise((resolve) => {
      releaseSave = resolve;
    }));
    serverMocks.selectTrainingPuzzle.mockResolvedValue(forkPuzzle);
    const payload = basePayload();
    const authorizationExpiresAt = new Date(Date.now() + (60 * 60 * 1000)).toISOString();
    const token = createPuzzleSessionToken({
      ...payload,
      version: 2,
      nextMoveIndex: 3,
      expiresAt: authorizationExpiresAt,
      puzzle: {
        id: multiMovePuzzle.id,
        initial_fen: multiMovePuzzle.initial_fen,
        moves: multiMovePuzzle.moves,
        start_mode: multiMovePuzzle.start_mode,
        accepted_moves: multiMovePuzzle.accepted_moves,
        themes: multiMovePuzzle.themes,
        rating: multiMovePuzzle.rating,
        game_url: multiMovePuzzle.game_url
      }
    });

    let responseSettled = false;
    const responsePromise = POST(requestWithToken(
      token,
      { from: "f7", to: "f8" },
      { requestNextPuzzle: true }
    )).then((response) => {
      responseSettled = true;
      return response;
    });
    await vi.waitFor(() => expect(serverMocks.saveTrainingAttempt).toHaveBeenCalledOnce());
    expect(responseSettled).toBe(false);

    releaseSave?.({ elapsedSeconds: 12, firstTryCorrect: true });
    const response = await responsePromise;
    const result = await response.json();
    const nextPayload = readPuzzleSessionToken(result.nextPuzzle.token);

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ accepted: true, completed: true });
    expect(nextPayload.version).toBe(2);
    if (nextPayload.version === 2) expect(nextPayload.expiresAt).toBe(authorizationExpiresAt);
  });
});
