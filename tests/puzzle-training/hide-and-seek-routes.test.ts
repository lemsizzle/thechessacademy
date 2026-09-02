import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  finishHideAndSeekRound: vi.fn(),
  isHideAndSeekAuthenticationError: vi.fn(),
  requireHideAndSeekStudent: vi.fn(),
  startHideAndSeekRound: vi.fn()
}));

vi.mock("@/lib/puzzle-training/hideAndSeekServer", () => {
  class HideAndSeekInputError extends Error {}
  return {
    HideAndSeekInputError,
    finishHideAndSeekRound: mocks.finishHideAndSeekRound,
    isHideAndSeekAuthenticationError: mocks.isHideAndSeekAuthenticationError,
    requireHideAndSeekStudent: mocks.requireHideAndSeekStudent,
    startHideAndSeekRound: mocks.startHideAndSeekRound
  };
});

vi.mock("@/lib/puzzle-training/hideAndSeekToken", () => {
  class HideAndSeekTokenError extends Error {}
  return { HideAndSeekTokenError };
});

import { HideAndSeekInputError } from "@/lib/puzzle-training/hideAndSeekServer";
import { HideAndSeekTokenError } from "@/lib/puzzle-training/hideAndSeekToken";
import { POST as finishRoute } from "@/app/api/student/hide-and-seek/finish/route";
import { POST as startRoute } from "@/app/api/student/hide-and-seek/start/route";

const studentId = "20000000-0000-4000-8000-000000000002";

function request(path: string, body: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
}

describe("Hide and Seek API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireHideAndSeekStudent.mockResolvedValue({ studentId });
    mocks.isHideAndSeekAuthenticationError.mockReturnValue(false);
  });

  it("starts one covered round with an opaque active token and server timing", async () => {
    const started = {
      round: {
        id: "round-1",
        pieces: [{ piece: "bK", square: "a1" }],
        mode: "time_trial",
        timeLimitMs: 60_000,
        startedAt: "2026-08-29T08:00:02.000Z",
        expiresAt: "2026-08-29T08:30:02.000Z"
      },
      token: "active-token",
      serverSentAt: "2026-08-29T08:00:00.000Z"
    };
    mocks.startHideAndSeekRound.mockReturnValue(started);

    const response = await startRoute(request(
      "/api/student/hide-and-seek/start",
      JSON.stringify({ mode: "time_trial" })
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ...started, serverReceivedAt: expect.any(String) });
    expect(Date.parse(payload.serverReceivedAt)).not.toBeNaN();
    expect(mocks.startHideAndSeekRound).toHaveBeenCalledWith(studentId, undefined, "time_trial");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns useful client errors while hiding unexpected start failures", async () => {
    const malformed = await startRoute(request("/api/student/hide-and-seek/start", "not-json"));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "The start request must contain valid JSON." });

    const invalidMode = await startRoute(request(
      "/api/student/hide-and-seek/start",
      JSON.stringify({ mode: "blitz" })
    ));
    expect(invalidMode.status).toBe(400);
    expect(await invalidMode.json()).toEqual({ error: "Choose Classic, Time Trial, or Hard mode." });

    mocks.startHideAndSeekRound.mockImplementationOnce(() => {
      throw new Error("postgres connection string and internal details");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unavailable = await startRoute(request("/api/student/hide-and-seek/start", "{}"));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
      error: "Hide and Seek is temporarily unavailable. Please try again."
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns the authoritative finish result and maps token/input errors", async () => {
    const result = {
      mode: "classic",
      score: 900,
      totalSafe: 12,
      correctCount: 11,
      wrongCount: 0,
      foundPercent: 91.7,
      elapsedMs: 14_000,
      personalBest: 900,
      completedAt: "2026-08-29T08:00:16.000Z",
      correctSquares: ["a1"],
      wrongSquares: [],
      missedSquares: ["b1"],
      safeSquares: ["a1", "b1"]
    };
    mocks.finishHideAndSeekRound.mockResolvedValueOnce(result);

    const response = await finishRoute(request(
      "/api/student/hide-and-seek/finish",
      JSON.stringify({ token: "active-token", selectedSquares: ["a1"] })
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result });
    expect(mocks.finishHideAndSeekRound).toHaveBeenCalledWith({
      studentId,
      token: "active-token",
      selectedSquares: ["a1"],
      nowMs: expect.any(Number)
    });

    mocks.finishHideAndSeekRound.mockRejectedValueOnce(new HideAndSeekInputError("Duplicate square."));
    const inputFailure = await finishRoute(request(
      "/api/student/hide-and-seek/finish",
      JSON.stringify({ token: "active-token", selectedSquares: ["a1", "a1"] })
    ));
    expect(inputFailure.status).toBe(400);
    expect(await inputFailure.json()).toEqual({ error: "Duplicate square." });

    mocks.finishHideAndSeekRound.mockRejectedValueOnce(new HideAndSeekTokenError("Round expired.", "expired"));
    const tokenFailure = await finishRoute(request(
      "/api/student/hide-and-seek/finish",
      JSON.stringify({ token: "expired", selectedSquares: ["a1"] })
    ));
    expect(tokenFailure.status).toBe(401);
    expect(await tokenFailure.json()).toEqual({ error: "Round expired." });
  });

  it("rejects a non-object finish body as a client error", async () => {
    const response = await finishRoute(request("/api/student/hide-and-seek/finish", "null"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The scoring request must be a JSON object." });
    expect(mocks.finishHideAndSeekRound).not.toHaveBeenCalled();
  });

  it("does not leak unexpected finish errors", async () => {
    mocks.finishHideAndSeekRound.mockRejectedValueOnce(new Error("private PostgREST response"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await finishRoute(request(
      "/api/student/hide-and-seek/finish",
      JSON.stringify({ token: "active-token", selectedSquares: ["a1"] })
    ));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Your search could not be scored right now. Please try again."
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
