import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HIDE_AND_SEEK_MAX_SAFE_SQUARES,
  HIDE_AND_SEEK_MIN_SAFE_SQUARES,
  generateHideAndSeekBoard,
  type HideAndSeekMode,
  type HideAndSeekSquare
} from "@/lib/puzzle-training/hideAndSeek";
import {
  HIDE_AND_SEEK_ACTIVATION_GRACE_MS,
  HIDE_AND_SEEK_ROUND_DURATION_MS,
  HIDE_AND_SEEK_TIME_TRIAL_SUBMISSION_GRACE_MS,
  createHideAndSeekRoundToken,
  readHideAndSeekRoundToken
} from "@/lib/puzzle-training/hideAndSeekToken";

const mocks = vi.hoisted(() => ({ getSupabaseServiceClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.getSupabaseServiceClient }));
vi.mock("@/lib/auth/requireActiveStudent", () => {
  class StudentAuthenticationError extends Error {}
  return {
    StudentAuthenticationError,
    requireActiveStudent: vi.fn()
  };
});

import {
  finishHideAndSeekRound,
  parseHideAndSeekSelections,
  startHideAndSeekRound
} from "@/lib/puzzle-training/hideAndSeekServer";

const studentId = "20000000-0000-4000-8000-000000000002";
const startedAtMs = Date.parse("2026-08-29T08:00:00.000Z");

function acceptedSeed() {
  for (let value = 0; value < 1_000; value += 1) {
    const seed = value.toString(16).padStart(32, "0");
    const board = generateHideAndSeekBoard(seed);
    if (board.safeSquares.length >= HIDE_AND_SEEK_MIN_SAFE_SQUARES
      && board.safeSquares.length <= HIDE_AND_SEEK_MAX_SAFE_SQUARES) return seed;
  }
  throw new Error("Test could not find a balanced board seed.");
}

function roundToken(roundId: string, seed: string, mode: HideAndSeekMode = "classic") {
  const durationMs = mode === "time_trial"
    ? 60_000 + HIDE_AND_SEEK_TIME_TRIAL_SUBMISSION_GRACE_MS
    : 30 * 60_000;
  return createHideAndSeekRoundToken({
    version: 1,
    stage: "active",
    studentId,
    roundId,
    generatorVersion: 1,
    seed,
    mode,
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: new Date(startedAtMs + durationMs).toISOString()
  });
}

function createAttemptClient() {
  const rows = new Map<string, Record<string, unknown>>();
  const insert = vi.fn(async (record: Record<string, unknown>) => {
    const key = `${record.student_id}:${record.round_id}`;
    if (rows.has(key)) return { error: { code: "23505", message: "duplicate" } };
    rows.set(key, record);
    return { error: null };
  });

  const from = vi.fn(() => {
    let selectedColumns = "";
    const equality = new Map<string, unknown>();
    const query = {
      select: vi.fn((columns: string) => {
        selectedColumns = columns;
        return query;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        equality.set(column, value);
        return query;
      }),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => {
        if (selectedColumns === "score") {
          const studentRows = [...rows.values()]
            .filter((row) => row.student_id === equality.get("student_id"))
            .sort((left, right) => Number(right.score) - Number(left.score));
          return { data: studentRows[0] ? { score: studentRows[0].score } : null, error: null };
        }
        const key = `${equality.get("student_id")}:${equality.get("round_id")}`;
        return { data: rows.get(key) ?? null, error: null };
      }),
      insert
    };
    return query;
  });

  return { from, insert, rows };
}

describe("Hide and Seek server persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
  });

  it("validates a unique list of board squares", () => {
    expect(parseHideAndSeekSelections(["a1", "h8"])).toEqual(["a1", "h8"]);
    expect(() => parseHideAndSeekSelections(["a1", "a1"])).toThrow(/only be selected once/i);
    expect(() => parseHideAndSeekSelections(["z9"])).toThrow(/invalid/i);
    expect(() => parseHideAndSeekSelections([])).toThrow(/at least one/i);
    expect(parseHideAndSeekSelections([], { allowEmpty: true })).toEqual([]);
  });

  it("issues one fixed authoritative start for each newly generated round", () => {
    const first = startHideAndSeekRound(studentId, startedAtMs);
    const second = startHideAndSeekRound(studentId, startedAtMs + 1_500);

    expect(first.round).toEqual(expect.objectContaining({
      id: expect.any(String),
      pieces: expect.any(Array),
      mode: "classic",
      timeLimitMs: null
    }));
    expect(first.serverSentAt).toBe(new Date(startedAtMs).toISOString());
    expect(first.round.startedAt).toBe(new Date(startedAtMs + HIDE_AND_SEEK_ACTIVATION_GRACE_MS).toISOString());
    expect(second.round.id).not.toBe(first.round.id);

    const payload = readHideAndSeekRoundToken(first.token, Date.parse(first.round.startedAt));
    expect(payload).toMatchObject({ roundId: first.round.id, mode: "classic", startedAt: first.round.startedAt });
    expect(generateHideAndSeekBoard(payload.seed).pieces).toEqual(first.round.pieces);
  });

  it("issues and accepts a zero-mark 60-second Time Trial result", async () => {
    const client = createAttemptClient();
    mocks.getSupabaseServiceClient.mockReturnValue(client);
    const started = startHideAndSeekRound(studentId, startedAtMs, "time_trial");

    expect(started.round).toMatchObject({ mode: "time_trial", timeLimitMs: 60_000 });
    expect(Date.parse(started.round.expiresAt) - Date.parse(started.round.startedAt)).toBe(
      60_000 + HIDE_AND_SEEK_TIME_TRIAL_SUBMISSION_GRACE_MS
    );

    const result = await finishHideAndSeekRound({
      studentId,
      token: started.token,
      selectedSquares: [],
      nowMs: Date.parse(started.round.startedAt) + 61_000
    });

    expect(result).toMatchObject({ mode: "time_trial", elapsedMs: 60_000, score: 0 });
    expect([...client.rows.values()][0]).toMatchObject({ mode: "time_trial", selected_squares: [] });
  });

  it("persists a dangerous-square Hard Mode result as an immediate loss", async () => {
    const client = createAttemptClient();
    mocks.getSupabaseServiceClient.mockReturnValue(client);
    const seed = acceptedSeed();
    const board = generateHideAndSeekBoard(seed);
    const occupied = new Set(board.pieces.map((piece) => piece.square));
    const dangerousSquare = Array.from({ length: 64 }, (_, index) => (
      `${String.fromCharCode(97 + index % 8)}${Math.floor(index / 8) + 1}` as HideAndSeekSquare
    )).find((square) => !occupied.has(square) && !board.safeSquares.includes(square));
    expect(dangerousSquare).toBeDefined();
    if (!dangerousSquare) throw new Error("Test board did not contain a dangerous empty square.");
    const token = roundToken("30000000-0000-4000-8000-000000000008", seed, "hard");

    const result = await finishHideAndSeekRound({
      studentId,
      token,
      selectedSquares: [board.safeSquares[0], dangerousSquare],
      nowMs: startedAtMs + 2_000
    });

    expect(result).toMatchObject({ mode: "hard", score: 0, correctCount: 1, wrongCount: 1 });
    expect([...client.rows.values()][0]).toMatchObject({ mode: "hard", score: 0 });
  });

  it("recomputes, saves, and returns the authoritative result", async () => {
    const client = createAttemptClient();
    mocks.getSupabaseServiceClient.mockReturnValue(client);
    const seed = acceptedSeed();
    const board = generateHideAndSeekBoard(seed);
    const token = roundToken("30000000-0000-4000-8000-000000000003", seed);

    const result = await finishHideAndSeekRound({
      studentId,
      token,
      selectedSquares: [board.safeSquares[0]],
      nowMs: startedAtMs + 10_000
    });

    expect(result).toMatchObject({
      mode: "classic",
      correctCount: 1,
      wrongCount: 0,
      elapsedMs: 10_000,
      personalBest: result.score,
      completedAt: new Date(startedAtMs + 10_000).toISOString()
    });
    expect(result.safeSquares).toEqual(board.safeSquares);
    expect(client.insert).toHaveBeenCalledTimes(1);
    expect([...client.rows.values()][0]).toMatchObject({
      student_id: studentId,
      mode: "classic",
      seed,
      selected_squares: [board.safeSquares[0]],
      safe_square_count: board.safeSquares.length,
      correct_count: 1,
      wrong_count: 0,
      elapsed_ms: 10_000,
      score: result.score
    });
  });

  it("returns the original saved result when completion is retried", async () => {
    const client = createAttemptClient();
    mocks.getSupabaseServiceClient.mockReturnValue(client);
    const seed = acceptedSeed();
    const board = generateHideAndSeekBoard(seed);
    const token = roundToken("30000000-0000-4000-8000-000000000004", seed);

    const first = await finishHideAndSeekRound({
      studentId,
      token,
      selectedSquares: [board.safeSquares[0]],
      nowMs: startedAtMs + 5_000
    });
    const retried = await finishHideAndSeekRound({
      studentId,
      token,
      selectedSquares: [board.safeSquares[1]],
      nowMs: startedAtMs + 20_000
    });

    expect(retried).toEqual(first);
    expect(client.insert).toHaveBeenCalledTimes(1);
  });

  it("replays a saved result after token expiry but rejects an unsaved expired round", async () => {
    const client = createAttemptClient();
    mocks.getSupabaseServiceClient.mockReturnValue(client);
    const seed = acceptedSeed();
    const board = generateHideAndSeekBoard(seed);
    const savedToken = roundToken("30000000-0000-4000-8000-000000000006", seed);
    const saved = await finishHideAndSeekRound({
      studentId,
      token: savedToken,
      selectedSquares: [board.safeSquares[0]],
      nowMs: startedAtMs + 5_000
    });

    await expect(finishHideAndSeekRound({
      studentId,
      token: savedToken,
      selectedSquares: [board.safeSquares[1]],
      nowMs: startedAtMs + HIDE_AND_SEEK_ROUND_DURATION_MS + 1
    })).resolves.toEqual(saved);

    await expect(finishHideAndSeekRound({
      studentId,
      token: roundToken("30000000-0000-4000-8000-000000000007", seed),
      selectedSquares: [board.safeSquares[0]],
      nowMs: startedAtMs + HIDE_AND_SEEK_ROUND_DURATION_MS + 1
    })).rejects.toThrow(/round expired/i);
    expect(client.insert).toHaveBeenCalledTimes(1);
  });

  it("does not accept a score before the fixed reveal clock starts", async () => {
    const client = createAttemptClient();
    mocks.getSupabaseServiceClient.mockReturnValue(client);
    const active = startHideAndSeekRound(studentId, startedAtMs);

    await expect(finishHideAndSeekRound({
      studentId,
      token: active.token,
      selectedSquares: [generateHideAndSeekBoard(readHideAndSeekRoundToken(
        active.token,
        startedAtMs + 100,
        { allowExpired: true }
      ).seed).safeSquares[0]],
      nowMs: startedAtMs + 500
    })).rejects.toThrow(/not started yet/i);
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("rejects occupied squares and tokens belonging to another student", async () => {
    const client = createAttemptClient();
    mocks.getSupabaseServiceClient.mockReturnValue(client);
    const seed = acceptedSeed();
    const board = generateHideAndSeekBoard(seed);
    const token = roundToken("30000000-0000-4000-8000-000000000005", seed);

    await expect(finishHideAndSeekRound({
      studentId,
      token,
      selectedSquares: [board.pieces[0].square],
      nowMs: startedAtMs + 1_000
    })).rejects.toThrow(/holding a black piece/i);

    await expect(finishHideAndSeekRound({
      studentId: "40000000-0000-4000-8000-000000000004",
      token,
      selectedSquares: [board.safeSquares[0]],
      nowMs: startedAtMs + 1_000
    })).rejects.toThrow(/different student/i);
  });
});
