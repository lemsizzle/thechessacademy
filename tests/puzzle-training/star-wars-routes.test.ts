import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  isStarWarsAuthenticationError: vi.fn(),
  requireStarWarsStudent: vi.fn(),
  saveStarWarsProgress: vi.fn(),
  startStarWarsRun: vi.fn()
}));

vi.mock("@/lib/puzzle-training/starWarsServer", () => {
  class StarWarsInputError extends Error {}
  return {
    StarWarsInputError,
    isStarWarsAuthenticationError: mocks.isStarWarsAuthenticationError,
    requireStarWarsStudent: mocks.requireStarWarsStudent,
    saveStarWarsProgress: mocks.saveStarWarsProgress,
    startStarWarsRun: mocks.startStarWarsRun
  };
});

import { POST as progressRoute } from "@/app/api/student/star-wars/progress/route";
import { POST as startRoute } from "@/app/api/student/star-wars/start/route";

const studentId = "20000000-0000-4000-8000-000000000002";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/student/star-wars/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("Star Wars API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStarWarsStudent.mockResolvedValue({ studentId });
    mocks.isStarWarsAuthenticationError.mockReturnValue(false);
  });

  it("starts a server-owned run without accepting a browser seed", async () => {
    const run = { runId: "run-1", runVariant: 42, score: 0, personalBest: 12 };
    mocks.startStarWarsRun.mockResolvedValue(run);

    const response = await startRoute();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ run });
    expect(mocks.startStarWarsRun).toHaveBeenCalledWith(studentId);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes only authenticated run progress to server verification", async () => {
    const routes = [[{ from: "a1", to: "a2" }]];
    mocks.saveStarWarsProgress.mockResolvedValue({ score: 4, personalBest: 9 });

    const response = await progressRoute(request({ runId: "run-1", startScore: 3, routes }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: { score: 4, personalBest: 9 } });
    expect(mocks.saveStarWarsProgress).toHaveBeenCalledWith({
      studentId,
      runId: "run-1",
      startScore: 3,
      routes
    });
  });

  it("rejects non-object progress requests before persistence", async () => {
    const response = await progressRoute(request([]));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The Star Wars score request must be a JSON object." });
    expect(mocks.saveStarWarsProgress).not.toHaveBeenCalled();
  });
});
