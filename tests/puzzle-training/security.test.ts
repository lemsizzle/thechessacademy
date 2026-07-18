import { beforeEach, describe, expect, it } from "vitest";
import { assertPuzzleTokenStudent, createPuzzleSessionToken, readPuzzleSessionToken } from "../../lib/puzzle-training/sessionToken";

const payload = {
  version: 1 as const,
  puzzleId: "10000000-0000-4000-8000-000000000001",
  studentId: "20000000-0000-4000-8000-000000000002",
  sessionId: "30000000-0000-4000-8000-000000000003",
  selectedTheme: "fork" as const,
  nextMoveIndex: 1,
  startedAt: "2026-07-18T00:00:00.000Z",
  incorrectMoveCount: 0,
  hintsUsed: 0
};

describe("signed puzzle sessions", () => {
  beforeEach(() => {
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
  });

  it("round-trips a signed server state token", () => {
    expect(readPuzzleSessionToken(createPuzzleSessionToken(payload))).toEqual(payload);
  });

  it("rejects answer-state tampering", () => {
    const token = createPuzzleSessionToken(payload);
    const [encoded, signature] = token.split(".");
    const changed = Buffer.from(JSON.stringify({ ...payload, nextMoveIndex: 3 })).toString("base64url");
    expect(() => readPuzzleSessionToken(`${changed}.${signature || encoded}`)).toThrow(/signature/i);
  });

  it("binds each token to one student", () => {
    expect(() => assertPuzzleTokenStudent(payload, "40000000-0000-4000-8000-000000000004")).toThrow(/does not belong/i);
  });
});
