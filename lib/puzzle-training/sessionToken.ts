import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  parsePuzzleTrainingMode,
  puzzleThemeSlugs,
  puzzleTrainingModes,
  type PuzzleSessionPuzzle,
  type PuzzleThemeSlug,
  type PuzzleTrainingMode
} from "@/lib/puzzle-training/types";

type PuzzleSessionBase = {
  puzzleId: string;
  studentId: string;
  sessionId: string;
  selectedTheme: PuzzleThemeSlug;
  trainingMode: PuzzleTrainingMode;
  dailyDate?: string;
  nextMoveIndex: number;
  startedAt: string;
  incorrectMoveCount: number;
  hintsUsed: number;
};

export type LegacyPuzzleSessionToken = PuzzleSessionBase & { version: 1 };

export type OpaquePuzzleSessionToken = PuzzleSessionBase & {
  version: 2;
  expiresAt: string;
  puzzle: PuzzleSessionPuzzle;
};

export type PuzzleSessionToken = LegacyPuzzleSessionToken | OpaquePuzzleSessionToken;

type PuzzleSessionTokenInput = Omit<PuzzleSessionBase, "trainingMode"> & {
  version: 1 | 2;
  trainingMode?: PuzzleTrainingMode;
  expiresAt?: string;
  puzzle?: PuzzleSessionPuzzle;
};

const OPAQUE_TOKEN_PREFIX = "v2";
const OPAQUE_TOKEN_AAD = Buffer.from("chess-academy:puzzle-session:v2", "utf8");
const OPAQUE_TOKEN_MAX_LENGTH = 16_384;
const OPAQUE_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function tokenSecret() {
  const value = process.env.PUZZLE_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 24) throw new Error("PUZZLE_SESSION_SECRET must be configured with at least 24 characters.");
  return value;
}

function legacySignature(encodedPayload: string) {
  return createHmac("sha256", tokenSecret()).update(encodedPayload).digest("base64url");
}

function encryptionKey() {
  return createHmac("sha256", tokenSecret())
    .update("chess-academy:puzzle-session:encryption-key:v2")
    .digest();
}

function invalidToken(): never {
  throw new Error("Invalid puzzle session token.");
}

function parseJsonPayload(value: Buffer | string) {
  try {
    return JSON.parse(typeof value === "string" ? value : value.toString("utf8")) as unknown;
  } catch {
    return invalidToken();
  }
}

function isNonnegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0;
}

function validPuzzleSnapshot(value: unknown, puzzleId: string): value is PuzzleSessionPuzzle {
  if (!value || typeof value !== "object") return false;
  const puzzle = value as Partial<PuzzleSessionPuzzle>;
  return puzzle.id === puzzleId
    && UUID_PATTERN.test(puzzle.id)
    && typeof puzzle.initial_fen === "string"
    && puzzle.initial_fen.length > 0
    && puzzle.initial_fen.length <= 200
    && Array.isArray(puzzle.moves)
    && puzzle.moves.length > 0
    && puzzle.moves.length <= 128
    && puzzle.moves.every((move) => typeof move === "string" && UCI_PATTERN.test(move))
    && (puzzle.start_mode === "after_setup" || puzzle.start_mode === "direct")
    && Array.isArray(puzzle.accepted_moves)
    && puzzle.accepted_moves.length <= 32
    && puzzle.accepted_moves.every((move) => typeof move === "string" && UCI_PATTERN.test(move))
    && Array.isArray(puzzle.themes)
    && puzzle.themes.length <= 64
    && puzzle.themes.every((theme) => typeof theme === "string" && theme.length <= 64)
    && (puzzle.rating === null || (typeof puzzle.rating === "number" && Number.isFinite(puzzle.rating)))
    && (puzzle.game_url === null || (typeof puzzle.game_url === "string" && puzzle.game_url.length <= 2_048));
}

function validatePayload(value: unknown): PuzzleSessionToken {
  if (!value || typeof value !== "object") return invalidToken();
  const payload = value as Partial<PuzzleSessionTokenInput>;
  if ((payload.version !== 1 && payload.version !== 2)
    || !UUID_PATTERN.test(payload.puzzleId ?? "")
    || !UUID_PATTERN.test(payload.studentId ?? "")
    || !UUID_PATTERN.test(payload.sessionId ?? "")
    || !puzzleThemeSlugs.includes(payload.selectedTheme as PuzzleThemeSlug)
    || !isNonnegativeInteger(payload.nextMoveIndex)
    || !isNonnegativeInteger(payload.incorrectMoveCount)
    || !isNonnegativeInteger(payload.hintsUsed)
    || typeof payload.startedAt !== "string"
    || !Number.isFinite(Date.parse(payload.startedAt))) return invalidToken();

  const trainingMode = parsePuzzleTrainingMode(typeof payload.trainingMode === "string" ? payload.trainingMode : null);
  if (payload.trainingMode !== undefined && !puzzleTrainingModes.includes(payload.trainingMode as PuzzleTrainingMode)) return invalidToken();

  const common: PuzzleSessionBase = {
    puzzleId: payload.puzzleId as string,
    studentId: payload.studentId as string,
    sessionId: payload.sessionId as string,
    selectedTheme: payload.selectedTheme as PuzzleThemeSlug,
    trainingMode,
    ...(typeof payload.dailyDate === "string" ? { dailyDate: payload.dailyDate } : {}),
    nextMoveIndex: payload.nextMoveIndex as number,
    startedAt: payload.startedAt as string,
    incorrectMoveCount: payload.incorrectMoveCount as number,
    hintsUsed: payload.hintsUsed as number
  };

  if (payload.version === 1) return { version: 1, ...common };
  if (typeof payload.expiresAt !== "string" || !Number.isFinite(Date.parse(payload.expiresAt))) return invalidToken();
  const startedAt = Date.parse(payload.startedAt);
  const expiresAt = Date.parse(payload.expiresAt);
  if (expiresAt <= Date.now() || expiresAt <= startedAt || expiresAt - startedAt > OPAQUE_TOKEN_MAX_AGE_MS) {
    throw new Error("Puzzle session has expired. Load the puzzle again.");
  }
  if (!validPuzzleSnapshot(payload.puzzle, common.puzzleId)) return invalidToken();
  return { version: 2, ...common, expiresAt: payload.expiresAt as string, puzzle: payload.puzzle };
}

function createLegacyToken(payload: PuzzleSessionTokenInput) {
  const encoded = Buffer.from(JSON.stringify({
    ...payload,
    version: 1,
    trainingMode: payload.trainingMode ?? "legacy",
    expiresAt: undefined,
    puzzle: undefined
  }), "utf8").toString("base64url");
  return `${encoded}.${legacySignature(encoded)}`;
}

function createOpaqueToken(payload: PuzzleSessionTokenInput) {
  if (!payload.puzzle || !payload.expiresAt) return invalidToken();
  const normalized = validatePayload({ ...payload, version: 2, trainingMode: payload.trainingMode ?? "legacy" });
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(OPAQUE_TOKEN_AAD);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(normalized), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${OPAQUE_TOKEN_PREFIX}.${nonce.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function createPuzzleSessionToken(payload: PuzzleSessionTokenInput) {
  return payload.version === 2 ? createOpaqueToken(payload) : createLegacyToken(payload);
}

function readOpaqueToken(token: string) {
  if (token.length > OPAQUE_TOKEN_MAX_LENGTH) return invalidToken();
  const [prefix, nonceValue, ciphertextValue, tagValue, extra] = token.split(".");
  if (prefix !== OPAQUE_TOKEN_PREFIX || !nonceValue || !ciphertextValue || !tagValue || extra) return invalidToken();
  try {
    const nonce = Buffer.from(nonceValue, "base64url");
    const ciphertext = Buffer.from(ciphertextValue, "base64url");
    const tag = Buffer.from(tagValue, "base64url");
    if (nonce.length !== 12 || tag.length !== 16) return invalidToken();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), nonce);
    decipher.setAAD(OPAQUE_TOKEN_AAD);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return validatePayload(parseJsonPayload(plaintext));
  } catch (error) {
    if (error instanceof Error && /expired/i.test(error.message)) throw error;
    return invalidToken();
  }
}

function readLegacyToken(token: string) {
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return invalidToken();
  const expected = Buffer.from(legacySignature(encoded), "base64url");
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return invalidToken();
  return validatePayload(parseJsonPayload(Buffer.from(encoded, "base64url")));
}

export function readPuzzleSessionToken(token: string) {
  if (!token || token.length > OPAQUE_TOKEN_MAX_LENGTH) return invalidToken();
  return token.startsWith(`${OPAQUE_TOKEN_PREFIX}.`) ? readOpaqueToken(token) : readLegacyToken(token);
}

export function assertPuzzleTokenStudent(payload: PuzzleSessionToken, studentId: string) {
  if (payload.studentId !== studentId) throw new Error("Puzzle session does not belong to this student.");
}
