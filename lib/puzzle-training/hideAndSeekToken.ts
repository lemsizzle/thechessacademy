import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { isHideAndSeekMode, type HideAndSeekMode } from "@/lib/puzzle-training/hideAndSeek";

export const HIDE_AND_SEEK_ACTIVATION_GRACE_MS = 2_000;
export const HIDE_AND_SEEK_ROUND_DURATION_MS = 30 * 60 * 1_000;
export const HIDE_AND_SEEK_TIME_TRIAL_SUBMISSION_GRACE_MS = 15_000;

type HideAndSeekTokenBase = {
  version: 1;
  studentId: string;
  roundId: string;
  generatorVersion: number;
  seed: string;
  mode: HideAndSeekMode;
  stage: "active";
  startedAt: string;
  expiresAt: string;
};

export type HideAndSeekRoundToken = HideAndSeekTokenBase;

export class HideAndSeekTokenError extends Error {
  constructor(message: string, readonly code: "invalid" | "expired" | "wrong_student") {
    super(message);
    this.name = "HideAndSeekTokenError";
  }
}

const TOKEN_PREFIX = "hs1";
const TOKEN_AAD = Buffer.from("chess-academy:hide-and-seek-round:v1", "utf8");
const TOKEN_MAX_LENGTH = 4_096;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEED_PATTERN = /^[0-9a-f]{32}$/;

function tokenSecret() {
  const value = process.env.PUZZLE_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 24) {
    throw new Error("PUZZLE_SESSION_SECRET must be configured with at least 24 characters.");
  }
  return value;
}

function encryptionKey() {
  return createHmac("sha256", tokenSecret())
    .update("chess-academy:hide-and-seek-round:encryption-key:v1")
    .digest();
}

function invalidToken(): never {
  throw new HideAndSeekTokenError("This Hide and Seek token is invalid. Start a new search.", "invalid");
}

function parsePayload(value: Buffer) {
  try {
    return JSON.parse(value.toString("utf8")) as unknown;
  } catch {
    return invalidToken();
  }
}

function validatePayload(value: unknown): HideAndSeekRoundToken {
  if (!value || typeof value !== "object") return invalidToken();
  const payload = value as Record<string, unknown>;
  if (payload.version !== 1
    || payload.stage !== "active"
    || typeof payload.studentId !== "string"
    || !UUID_PATTERN.test(payload.studentId)
    || typeof payload.roundId !== "string"
    || !UUID_PATTERN.test(payload.roundId)
    || !Number.isInteger(payload.generatorVersion)
    || Number(payload.generatorVersion) < 1
    || typeof payload.seed !== "string"
    || !SEED_PATTERN.test(payload.seed)
    || typeof payload.expiresAt !== "string") return invalidToken();

  const mode = payload.mode === undefined ? "classic" : payload.mode;
  if (!isHideAndSeekMode(mode) || typeof payload.startedAt !== "string") return invalidToken();
  const issuedAtMs = Date.parse(payload.startedAt);
  const expiresAtMs = Date.parse(payload.expiresAt);
  const maximumDurationMs = mode === "time_trial"
    ? 60_000 + HIDE_AND_SEEK_TIME_TRIAL_SUBMISSION_GRACE_MS
    : HIDE_AND_SEEK_ROUND_DURATION_MS;
  if (!Number.isFinite(issuedAtMs)
    || !Number.isFinite(expiresAtMs)
    || expiresAtMs <= issuedAtMs
    || expiresAtMs - issuedAtMs > maximumDurationMs) return invalidToken();

  const base: HideAndSeekTokenBase = {
    version: 1,
    studentId: payload.studentId,
    roundId: payload.roundId,
    generatorVersion: payload.generatorVersion as number,
    seed: payload.seed,
    mode,
    stage: "active",
    startedAt: payload.startedAt,
    expiresAt: payload.expiresAt
  };
  return base;
}

function encryptToken(payload: HideAndSeekRoundToken) {
  const normalized = validatePayload(payload);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(TOKEN_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(normalized), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_PREFIX}.${nonce.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

function decryptToken(token: string) {
  if (!token || token.length > TOKEN_MAX_LENGTH) return invalidToken();
  const [prefix, nonceValue, ciphertextValue, tagValue, extra] = token.split(".");
  if (prefix !== TOKEN_PREFIX || !nonceValue || !ciphertextValue || !tagValue || extra) return invalidToken();

  try {
    const nonce = Buffer.from(nonceValue, "base64url");
    const ciphertext = Buffer.from(ciphertextValue, "base64url");
    const tag = Buffer.from(tagValue, "base64url");
    if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return invalidToken();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), nonce);
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return validatePayload(parsePayload(plaintext));
  } catch (error) {
    if (error instanceof HideAndSeekTokenError) throw error;
    return invalidToken();
  }
}

export function assertHideAndSeekTokenNotExpired(payload: HideAndSeekRoundToken, nowMs = Date.now()) {
  if (Date.parse(payload.expiresAt) <= nowMs) {
    throw new HideAndSeekTokenError("This Hide and Seek round expired. Start a new search.", "expired");
  }
}

export function createHideAndSeekRoundToken(payload: HideAndSeekRoundToken) {
  return encryptToken(payload);
}

export function readHideAndSeekRoundToken(
  token: string,
  nowMs = Date.now(),
  options: { allowExpired?: boolean } = {}
) {
  const payload = decryptToken(token);
  if (!options.allowExpired) assertHideAndSeekTokenNotExpired(payload, nowMs);
  return payload;
}

export function assertHideAndSeekTokenStudent(payload: HideAndSeekRoundToken, studentId: string) {
  if (payload.studentId !== studentId) {
    throw new HideAndSeekTokenError(
      "This Hide and Seek token belongs to a different student.",
      "wrong_student"
    );
  }
}
