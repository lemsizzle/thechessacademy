import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/student/puzzle-training/puzzle/route";
import { readPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { forkPuzzle } from "@/tests/fixtures/lichessPuzzles";

const serverMocks = vi.hoisted(() => ({
  getDailyTrainingPuzzle: vi.fn(),
  getTrainingPuzzle: vi.fn(),
  requirePuzzleStudent: vi.fn(),
  selectTrainingPuzzle: vi.fn()
}));

vi.mock("@/lib/puzzle-training/server", () => serverMocks);

const studentId = "20000000-0000-4000-8000-000000000002";
const sessionId = "30000000-0000-4000-8000-000000000003";
const woodpeckerRunId = "40000000-0000-4000-8000-000000000004";

function request(query: string) {
  return new NextRequest(`http://localhost/api/student/puzzle-training/puzzle?${query}`);
}

describe("puzzle route Woodpecker metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
    serverMocks.requirePuzzleStudent.mockResolvedValue({ studentId });
    serverMocks.selectTrainingPuzzle.mockResolvedValue(forkPuzzle);
  });

  it.each([
    `mode=woodpecker&woodpeckerRunId=${woodpeckerRunId}`,
    `mode=woodpecker&woodpeckerRunId=${woodpeckerRunId}&woodpeckerCycleNumber=4`,
    `mode=woodpecker&woodpeckerRunId=not-a-uuid&woodpeckerCycleNumber=1`,
    `mode=survival&woodpeckerRunId=${woodpeckerRunId}&woodpeckerCycleNumber=1`
  ])("rejects malformed run metadata: %s", async (query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid Woodpecker run metadata." });
    expect(serverMocks.requirePuzzleStudent).not.toHaveBeenCalled();
    expect(serverMocks.selectTrainingPuzzle).not.toHaveBeenCalled();
  });

  it("embeds valid run metadata in the opaque puzzle token", async () => {
    const response = await GET(request([
      "mode=woodpecker",
      `sessionId=${sessionId}`,
      `woodpeckerRunId=${woodpeckerRunId}`,
      "woodpeckerCycleNumber=2"
    ].join("&")));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(readPuzzleSessionToken(result.puzzle.token)).toMatchObject({
      studentId,
      sessionId,
      trainingMode: "woodpecker",
      woodpeckerRunId,
      woodpeckerCycleNumber: 2
    });
  });
});
