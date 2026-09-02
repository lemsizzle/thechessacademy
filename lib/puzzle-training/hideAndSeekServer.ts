import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { StudentAuthenticationError, requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import {
  HIDE_AND_SEEK_MAX_SAFE_SQUARES,
  HIDE_AND_SEEK_MIN_SAFE_SQUARES,
  HIDE_AND_SEEK_TIME_TRIAL_LIMIT_MS,
  calculateHideAndSeekScore,
  generateHideAndSeekBoard,
  generateHideAndSeekBoardForVersion,
  isHideAndSeekMode,
  isHideAndSeekSquare,
  type HideAndSeekBoard,
  type HideAndSeekMode,
  type HideAndSeekPiecePlacement,
  type HideAndSeekSquare
} from "@/lib/puzzle-training/hideAndSeek";
import {
  HIDE_AND_SEEK_ACTIVATION_GRACE_MS,
  HIDE_AND_SEEK_ROUND_DURATION_MS,
  HIDE_AND_SEEK_TIME_TRIAL_SUBMISSION_GRACE_MS,
  assertHideAndSeekTokenStudent,
  assertHideAndSeekTokenNotExpired,
  createHideAndSeekRoundToken,
  readHideAndSeekRoundToken
} from "@/lib/puzzle-training/hideAndSeekToken";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export class HideAndSeekInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HideAndSeekInputError";
  }
}

export type HideAndSeekStartResponse = {
  round: {
    id: string;
    pieces: readonly HideAndSeekPiecePlacement[];
    mode: HideAndSeekMode;
    timeLimitMs: number | null;
    startedAt: string;
    expiresAt: string;
  };
  token: string;
  serverSentAt: string;
};

export type HideAndSeekFinishResult = {
  mode: HideAndSeekMode;
  score: number;
  totalSafe: number;
  correctCount: number;
  wrongCount: number;
  foundPercent: number;
  elapsedMs: number;
  personalBest: number;
  correctSquares: readonly HideAndSeekSquare[];
  wrongSquares: readonly HideAndSeekSquare[];
  missedSquares: readonly HideAndSeekSquare[];
  safeSquares: readonly HideAndSeekSquare[];
  completedAt: string;
};

type HideAndSeekAttemptRow = {
  student_id: string;
  round_id: string;
  mode?: string | null;
  generator_version: number | string;
  seed: string;
  selected_squares: string[];
  elapsed_ms: number | string;
  completed_at: string;
};

const MAX_BOARD_GENERATION_ATTEMPTS = 16;
const ATTEMPT_SELECT = "student_id,round_id,mode,generator_version,seed,selected_squares,elapsed_ms,completed_at";

function serviceClient() {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Hide and Seek requires Supabase service access.");
  return client;
}

function generateAcceptedBoard(): HideAndSeekBoard {
  for (let attempt = 0; attempt < MAX_BOARD_GENERATION_ATTEMPTS; attempt += 1) {
    const board = generateHideAndSeekBoard(randomBytes(16).toString("hex"));
    if (board.safeSquares.length >= HIDE_AND_SEEK_MIN_SAFE_SQUARES
      && board.safeSquares.length <= HIDE_AND_SEEK_MAX_SAFE_SQUARES) return board;
  }
  throw new Error("Hide and Seek could not prepare a balanced board. Please try again.");
}

export function parseHideAndSeekSelections(
  value: unknown,
  options: { allowEmpty?: boolean } = {}
): HideAndSeekSquare[] {
  const minimum = options.allowEmpty ? 0 : 1;
  if (!Array.isArray(value) || value.length < minimum || value.length > 56) {
    throw new HideAndSeekInputError("Choose at least one square before scoring your search.");
  }
  const squares: HideAndSeekSquare[] = [];
  const unique = new Set<HideAndSeekSquare>();
  for (const valueSquare of value) {
    if (!isHideAndSeekSquare(valueSquare)) {
      throw new HideAndSeekInputError("One of the selected squares is invalid.");
    }
    if (unique.has(valueSquare)) {
      throw new HideAndSeekInputError("Each square may only be selected once.");
    }
    unique.add(valueSquare);
    squares.push(valueSquare);
  }
  return squares;
}

export async function requireHideAndSeekStudent() {
  return requireActiveStudent();
}

export function startHideAndSeekRound(
  studentId: string,
  nowMs?: number,
  mode: HideAndSeekMode = "classic"
): HideAndSeekStartResponse {
  const board = generateAcceptedBoard();
  const roundId = randomUUID();
  const activationMs = nowMs ?? Date.now();
  const serverSentAt = new Date(activationMs).toISOString();
  const startedAt = new Date(activationMs + HIDE_AND_SEEK_ACTIVATION_GRACE_MS).toISOString();
  const timeLimitMs = mode === "time_trial" ? HIDE_AND_SEEK_TIME_TRIAL_LIMIT_MS : null;
  const tokenDurationMs = timeLimitMs === null
    ? HIDE_AND_SEEK_ROUND_DURATION_MS
    : timeLimitMs + HIDE_AND_SEEK_TIME_TRIAL_SUBMISSION_GRACE_MS;
  const expiresAt = new Date(Date.parse(startedAt) + tokenDurationMs).toISOString();
  const token = createHideAndSeekRoundToken({
    version: 1,
    stage: "active",
    studentId,
    roundId,
    generatorVersion: board.generatorVersion,
    seed: board.seed,
    mode,
    startedAt,
    expiresAt
  });

  return {
    round: { id: roundId, pieces: board.pieces, mode, timeLimitMs, startedAt, expiresAt },
    token,
    serverSentAt
  };
}

async function getSavedAttempt(studentId: string, roundId: string) {
  const { data, error } = await serviceClient()
    .from("student_hide_and_seek_attempts")
    .select(ATTEMPT_SELECT)
    .eq("student_id", studentId)
    .eq("round_id", roundId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as HideAndSeekAttemptRow | null;
}

async function getPersonalBest(studentId: string) {
  const { data, error } = await serviceClient()
    .from("student_hide_and_seek_attempts")
    .select("score")
    .eq("student_id", studentId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Math.max(0, Number((data as { score?: number | string } | null)?.score ?? 0));
}

function resultFor(
  board: HideAndSeekBoard,
  selectedSquares: readonly HideAndSeekSquare[],
  elapsedMs: number,
  personalBest: number,
  completedAt: string,
  mode: HideAndSeekMode
): HideAndSeekFinishResult {
  const score = calculateHideAndSeekScore({
    safeSquares: board.safeSquares,
    selectedSquares,
    elapsedMs,
    mode
  });
  return {
    mode,
    score: score.score,
    totalSafe: score.totalSafe,
    correctCount: score.correctCount,
    wrongCount: score.wrongCount,
    foundPercent: score.foundPercent,
    elapsedMs: Math.round(score.elapsedMs),
    personalBest: Math.max(personalBest, score.score),
    correctSquares: score.correctSquares,
    wrongSquares: score.wrongSquares,
    missedSquares: score.missedSquares,
    safeSquares: board.safeSquares,
    completedAt
  };
}

function validatedStoredSelections(row: HideAndSeekAttemptRow) {
  const values = parseHideAndSeekSelections(row.selected_squares, {
    allowEmpty: row.mode === "time_trial"
  });
  return values;
}

export async function finishHideAndSeekRound(input: {
  studentId: string;
  token: string;
  selectedSquares: unknown;
  nowMs?: number;
}): Promise<HideAndSeekFinishResult> {
  if (typeof input.token !== "string" || !input.token) {
    throw new HideAndSeekInputError("Hide and Seek round token is required.");
  }
  const nowMs = input.nowMs ?? Date.now();
  const payload = readHideAndSeekRoundToken(input.token, nowMs, { allowExpired: true });
  assertHideAndSeekTokenStudent(payload, input.studentId);
  const board = generateHideAndSeekBoardForVersion(payload.generatorVersion, payload.seed);
  if (board.generatorVersion !== payload.generatorVersion
    || board.safeSquares.length < HIDE_AND_SEEK_MIN_SAFE_SQUARES
    || board.safeSquares.length > HIDE_AND_SEEK_MAX_SAFE_SQUARES) {
    throw new Error("Hide and Seek could not verify this board.");
  }

  const existing = await getSavedAttempt(input.studentId, payload.roundId);
  if (existing) {
    if (existing.seed !== payload.seed
      || Number(existing.generator_version) !== payload.generatorVersion) {
      throw new Error("Hide and Seek saved round verification failed.");
    }
    const [selectedSquares, personalBest] = await Promise.all([
      Promise.resolve(validatedStoredSelections(existing)),
      getPersonalBest(input.studentId)
    ]);
    const completedAt = new Date(existing.completed_at);
    if (Number.isNaN(completedAt.getTime())) throw new Error("Hide and Seek saved completion time is invalid.");
    return resultFor(
      board,
      selectedSquares,
      Math.max(0, Number(existing.elapsed_ms)),
      personalBest,
      completedAt.toISOString(),
      isHideAndSeekMode(existing.mode) ? existing.mode : "classic"
    );
  }

  assertHideAndSeekTokenNotExpired(payload, nowMs);
  if (nowMs < Date.parse(payload.startedAt)) {
    throw new HideAndSeekInputError("This search has not started yet.");
  }

  const selectedSquares = parseHideAndSeekSelections(input.selectedSquares, {
    allowEmpty: payload.mode === "time_trial"
  });
  const occupied = new Set(board.pieces.map((placement) => placement.square));
  if (selectedSquares.some((square) => occupied.has(square))) {
    throw new HideAndSeekInputError("A square holding a black piece cannot be marked.");
  }
  const elapsedMs = Math.max(0, Math.min(
    payload.mode === "time_trial" ? HIDE_AND_SEEK_TIME_TRIAL_LIMIT_MS : HIDE_AND_SEEK_ROUND_DURATION_MS,
    Math.round(nowMs - Date.parse(payload.startedAt))
  ));
  const completedAt = new Date(nowMs).toISOString();
  const result = resultFor(board, selectedSquares, elapsedMs, 0, completedAt, payload.mode);
  const record = {
    student_id: input.studentId,
    round_id: payload.roundId,
    mode: payload.mode,
    generator_version: payload.generatorVersion,
    seed: payload.seed,
    piece_placement: board.pieces,
    selected_squares: selectedSquares,
    safe_square_count: result.totalSafe,
    correct_count: result.correctCount,
    wrong_count: result.wrongCount,
    found_percent: result.foundPercent,
    elapsed_ms: result.elapsedMs,
    score: result.score,
    started_at: payload.startedAt,
    completed_at: completedAt
  };
  const { error } = await serviceClient()
    .from("student_hide_and_seek_attempts")
    .insert(record);

  if (error) {
    if (error.code !== "23505") throw new Error(error.message);
    const racedAttempt = await getSavedAttempt(input.studentId, payload.roundId);
    if (!racedAttempt) throw new Error("Hide and Seek could not load the saved result.");
    const racedSelections = validatedStoredSelections(racedAttempt);
    const personalBest = await getPersonalBest(input.studentId);
    const racedCompletedAt = new Date(racedAttempt.completed_at);
    if (Number.isNaN(racedCompletedAt.getTime())) throw new Error("Hide and Seek saved completion time is invalid.");
    return resultFor(
      board,
      racedSelections,
      Math.max(0, Number(racedAttempt.elapsed_ms)),
      personalBest,
      racedCompletedAt.toISOString(),
      isHideAndSeekMode(racedAttempt.mode) ? racedAttempt.mode : "classic"
    );
  }

  return { ...result, personalBest: await getPersonalBest(input.studentId) };
}

export function isHideAndSeekAuthenticationError(error: unknown) {
  return error instanceof StudentAuthenticationError;
}
