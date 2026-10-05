import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { readPuzzleSessionToken, createPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { preparePublicTrainingPuzzle } from "@/lib/puzzle-training/publicPuzzle";
import { forkPuzzle } from "@/tests/fixtures/lichessPuzzles";

const mocks = vi.hoisted(() => ({ requirePuzzleStudent: vi.fn(), requirePuzzleSessionStudent: vi.fn(), getTrainingPuzzle: vi.fn(),
  hasPuzzleHistory: vi.fn(), savePuzzleReplay: vi.fn(), saveTrainingAttempt: vi.fn(), awardDailyTrainingPuzzle: vi.fn(), selectTrainingPuzzle: vi.fn() }));
vi.mock("@/lib/puzzle-training/server", () => mocks);
vi.mock("@/lib/puzzle-training/dashboardServer", () => mocks);
import { POST as start } from "@/app/api/student/puzzle-training/replay/route";
import { POST as move } from "@/app/api/student/puzzle-training/move/route";
import { POST as finish } from "@/app/api/student/puzzle-training/finish/route";

const studentId = "20000000-0000-4000-8000-000000000002";
const request = (body: unknown) => new NextRequest("http://localhost/api/student/puzzle-training/replay", { method: "POST", body: JSON.stringify(body) });
function puzzleToken() {
  return preparePublicTrainingPuzzle({ puzzle: forkPuzzle, studentId, sessionId: crypto.randomUUID(), selectedTheme: "mixed", trainingMode: "legacy", dashboardReplay: true }).token;
}

describe("dashboard replay security and rewards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
    mocks.requirePuzzleStudent.mockResolvedValue({ studentId });
    mocks.requirePuzzleSessionStudent.mockResolvedValue({ studentId });
    mocks.hasPuzzleHistory.mockResolvedValue(true);
    mocks.getTrainingPuzzle.mockResolvedValue(forkPuzzle);
    mocks.savePuzzleReplay.mockResolvedValue(undefined);
  });

  it("requires login and enforces student-scoped history", async () => {
    mocks.requirePuzzleStudent.mockRejectedValueOnce(new StudentAuthenticationError("login required"));
    expect((await start(request({ puzzleId: forkPuzzle.id }))).status).toBe(401);
    mocks.hasPuzzleHistory.mockResolvedValueOnce(false);
    expect((await start(request({ puzzleId: forkPuzzle.id, studentId: "someone-else" }))).status).toBe(404);
    expect(mocks.hasPuzzleHistory).toHaveBeenCalledWith(studentId, forkPuzzle.id);
    expect(mocks.getTrainingPuzzle).not.toHaveBeenCalled();
  });

  it("rejects malformed requests and retired puzzles", async () => {
    expect((await start(request({ puzzleId: 5 }))).status).toBe(400);
    mocks.getTrainingPuzzle.mockResolvedValue(null);
    expect((await start(request({ puzzleId: forkPuzzle.id }))).status).toBe(404);
  });

  it("returns only an opaque puzzle and locks it to practice", async () => {
    const response = await start(request({ puzzleId: forkPuzzle.id, trainingMode: "daily" }));
    const body = await response.json();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.puzzle).not.toHaveProperty("moves");
    expect(body.puzzle).not.toHaveProperty("accepted_moves");
    expect(readPuzzleSessionToken(body.puzzle.token)).toMatchObject({ dashboardReplay: true, studentId, trainingMode: "legacy" });
  });

  it("saves a clean replay without attempts, rewards or chaining to another puzzle", async () => {
    const response = await move(request({ token: puzzleToken(), move: { from: "e5", to: "c6" }, requestNextPuzzle: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ completed: true, accepted: true });
    expect(mocks.savePuzzleReplay).toHaveBeenCalledWith(studentId, forkPuzzle.id);
    expect(mocks.saveTrainingAttempt).not.toHaveBeenCalled();
    expect(mocks.awardDailyTrainingPuzzle).not.toHaveBeenCalled();
    expect(mocks.selectTrainingPuzzle).not.toHaveBeenCalled();
  });

  it.each(["hintsUsed", "incorrectMoveCount"] as const)("does not clear helped solves: %s", async (field) => {
    const token = createPuzzleSessionToken({ ...readPuzzleSessionToken(puzzleToken()), [field]: 1 });
    const response = await move(request({ token, move: { from: "e5", to: "c6" } }));
    expect(response.status).toBe(200);
    expect(mocks.savePuzzleReplay).not.toHaveBeenCalled();
    expect(mocks.saveTrainingAttempt).not.toHaveBeenCalled();
  });

  it("preserves replay identity after a wrong move and ignores abandonment", async () => {
    const token = puzzleToken();
    const response = await move(request({ token, move: { from: "e5", to: "f3" } }));
    const body = await response.json();
    expect(body.accepted).toBe(false);
    expect(readPuzzleSessionToken(body.token)).toMatchObject({ dashboardReplay: true, incorrectMoveCount: 1 });
    expect((await finish(request({ token: body.token }))).status).toBe(200);
    expect(mocks.saveTrainingAttempt).not.toHaveBeenCalled();
  });

  it("rejects tampered and wrong-student tokens and invalid reward combinations", async () => {
    const token = puzzleToken();
    expect((await move(request({ token: token + "broken", move: { from: "e5", to: "c6" } }))).status).toBe(401);
    mocks.requirePuzzleSessionStudent.mockResolvedValue({ studentId: crypto.randomUUID() });
    expect((await move(request({ token, move: { from: "e5", to: "c6" } }))).status).toBe(401);
    expect(() => createPuzzleSessionToken({ ...readPuzzleSessionToken(token), trainingMode: "daily", dailyDate: "2026-10-05" })).toThrow();
    expect(mocks.savePuzzleReplay).not.toHaveBeenCalled();
  });
});
