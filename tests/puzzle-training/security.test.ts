import { beforeEach, describe, expect, it } from "vitest";
import { assertPuzzleTokenStudent, createPuzzleSessionToken, readPuzzleSessionToken } from "../../lib/puzzle-training/sessionToken";

const payload = {
  version: 1 as const,
  puzzleId: "10000000-0000-4000-8000-000000000001",
  studentId: "20000000-0000-4000-8000-000000000002",
  sessionId: "30000000-0000-4000-8000-000000000003",
  selectedTheme: "fork" as const,
  trainingMode: "survival" as const,
  nextMoveIndex: 1,
  startedAt: "2026-07-18T00:00:00.000Z",
  incorrectMoveCount: 0,
  hintsUsed: 0
};

const woodpeckerRunId = "40000000-0000-4000-8000-000000000004";

function opaquePayload() {
  const startedAt = new Date();
  return {
    ...payload,
    version: 2 as const,
    startedAt: startedAt.toISOString(),
    expiresAt: new Date(startedAt.getTime() + (60 * 60 * 1000)).toISOString(),
    puzzle: {
      id: payload.puzzleId,
      initial_fen: "8/8/8/8/8/8/4k3/6K1 w - - 0 1",
      moves: ["g1f1", "e2f2"],
      start_mode: "direct" as const,
      accepted_moves: [],
      themes: ["fork"],
      rating: 900,
      game_url: null
    }
  };
}

describe("signed puzzle sessions", () => {
  beforeEach(() => {
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
  });

  it("round-trips a signed server state token", () => {
    expect(readPuzzleSessionToken(createPuzzleSessionToken(payload))).toEqual(payload);
  });

  it("treats tokens issued before mode tracking as legacy attempts", () => {
    const { trainingMode: _trainingMode, ...legacyPayload } = payload;
    expect(readPuzzleSessionToken(createPuzzleSessionToken(legacyPayload))).toMatchObject({ trainingMode: "legacy" });
  });

  it("rejects answer-state tampering", () => {
    const token = createPuzzleSessionToken(payload);
    const [encoded, signature] = token.split(".");
    const changed = Buffer.from(JSON.stringify({ ...payload, nextMoveIndex: 3 })).toString("base64url");
    expect(() => readPuzzleSessionToken(`${changed}.${signature || encoded}`)).toThrow(/invalid puzzle session token/i);
  });

  it("round-trips an opaque v2 token without exposing the solution", () => {
    const source = opaquePayload();
    const token = createPuzzleSessionToken(source);

    expect(token.startsWith("v2.")).toBe(true);
    expect(token).not.toContain(source.puzzle.initial_fen);
    expect(token).not.toContain(source.puzzle.moves.join(""));
    expect(readPuzzleSessionToken(token)).toEqual(source);
  });

  it("binds Woodpecker run and cycle metadata into signed tokens", () => {
    const source = {
      ...opaquePayload(),
      trainingMode: "woodpecker" as const,
      woodpeckerRunId,
      woodpeckerCycleNumber: 2 as const
    };

    expect(readPuzzleSessionToken(createPuzzleSessionToken(source))).toEqual(source);
    expect(readPuzzleSessionToken(createPuzzleSessionToken({
      ...payload,
      trainingMode: "woodpecker",
      woodpeckerRunId,
      woodpeckerCycleNumber: 3
    }))).toMatchObject({ woodpeckerRunId, woodpeckerCycleNumber: 3 });
  });

  it("rejects partial or non-Woodpecker run metadata", () => {
    expect(() => readPuzzleSessionToken(createPuzzleSessionToken({
      ...opaquePayload(),
      trainingMode: "woodpecker",
      woodpeckerRunId
    }))).toThrow(/invalid puzzle session token/i);
    expect(() => readPuzzleSessionToken(createPuzzleSessionToken({
      ...opaquePayload(),
      trainingMode: "survival",
      woodpeckerRunId,
      woodpeckerCycleNumber: 1
    }))).toThrow(/invalid puzzle session token/i);
    expect(() => readPuzzleSessionToken(createPuzzleSessionToken({
      ...opaquePayload(),
      woodpeckerRunId,
      woodpeckerCycleNumber: 4 as 1
    }))).toThrow(/invalid puzzle session token/i);
  });

  it("uses a fresh nonce and rejects opaque-token tampering", () => {
    const source = opaquePayload();
    const first = createPuzzleSessionToken(source);
    const second = createPuzzleSessionToken(source);
    expect(first).not.toBe(second);

    const parts = first.split(".");
    parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith("A") ? "B" : "A"}`;
    expect(() => readPuzzleSessionToken(parts.join("."))).toThrow(/invalid puzzle session token/i);
  });

  it("rejects expired opaque sessions", () => {
    const source = opaquePayload();
    source.expiresAt = new Date(Date.now() - 1_000).toISOString();
    expect(() => createPuzzleSessionToken(source)).toThrow(/expired/i);
  });

  it("binds each token to one student", () => {
    expect(() => assertPuzzleTokenStudent(payload, "40000000-0000-4000-8000-000000000004")).toThrow(/does not belong/i);
  });
});
