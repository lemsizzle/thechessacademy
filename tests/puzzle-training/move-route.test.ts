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
const adaptiveReviewMocks = vi.hoisted(() => ({ saveSurvivalReviewMistake: vi.fn() }));
const nextServerMocks = vi.hoisted(() => ({ after: vi.fn((callback: () => unknown) => callback()) }));

vi.mock("@/lib/puzzle-training/server", () => serverMocks);
vi.mock("@/chess/training/adaptiveReviewServer", () => adaptiveReviewMocks);
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: nextServerMocks.after
}));

import { POST } from "@/app/api/student/puzzle-training/move/route";

const studentId = "20000000-0000-4000-8000-000000000002";
const sessionId = "30000000-0000-4000-8000-000000000003";
const woodpeckerRunId = "40000000-0000-4000-8000-000000000004";

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
    woodpeckerRunId,
    woodpeckerCycleNumber: 2 as const,
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
    adaptiveReviewMocks.saveSurvivalReviewMistake.mockResolvedValue(undefined);
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

  it("adds a legal Survival miss to adaptive review without delaying the response", async () => {
    const { woodpeckerRunId: _runId, woodpeckerCycleNumber: _cycleNumber, ...payload } = basePayload();
    const token = createPuzzleSessionToken({
      ...payload,
      version: 2,
      puzzleId: forkPuzzle.id,
      trainingMode: "survival",
      nextMoveIndex: 1,
      expiresAt: new Date(Date.now() + (60 * 60 * 1000)).toISOString(),
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

    const response = await POST(requestWithToken(token, { from: "e5", to: "f7" }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ accepted: false, completed: false });
    expect(nextServerMocks.after).toHaveBeenCalledOnce();
    expect(adaptiveReviewMocks.saveSurvivalReviewMistake).toHaveBeenCalledWith(expect.objectContaining({
      studentId,
      puzzle: expect.objectContaining({ id: forkPuzzle.id }),
      nextMoveIndex: 1,
      attemptedMoveUci: "e5f7",
      attemptedMoveSan: "Nf7"
    }));
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
    expect(serverMocks.saveTrainingAttempt).toHaveBeenCalledWith(expect.objectContaining({
      woodpeckerRunId,
      woodpeckerCycleNumber: 2
    }));
    expect(nextPayload.version).toBe(2);
    expect(nextPayload).toMatchObject({ woodpeckerRunId, woodpeckerCycleNumber: 2 });
    if (nextPayload.version === 2) expect(nextPayload.expiresAt).toBe(authorizationExpiresAt);
  });
});
