import { beforeEach, describe, expect, it } from "vitest";
import {
  HIDE_AND_SEEK_ACTIVATION_GRACE_MS,
  HIDE_AND_SEEK_ROUND_DURATION_MS,
  assertHideAndSeekTokenStudent,
  createHideAndSeekRoundToken,
  readHideAndSeekRoundToken,
  type HideAndSeekRoundToken
} from "@/lib/puzzle-training/hideAndSeekToken";

const nowMs = Date.parse("2026-08-29T08:00:00.000Z");
const base = {
  version: 1 as const,
  studentId: "20000000-0000-4000-8000-000000000002",
  roundId: "30000000-0000-4000-8000-000000000003",
  generatorVersion: 1,
  seed: "0123456789abcdef0123456789abcdef"
};
const activeRound: HideAndSeekRoundToken = {
  ...base,
  stage: "active",
  startedAt: new Date(nowMs + HIDE_AND_SEEK_ACTIVATION_GRACE_MS).toISOString(),
  expiresAt: new Date(nowMs + HIDE_AND_SEEK_ACTIVATION_GRACE_MS + HIDE_AND_SEEK_ROUND_DURATION_MS).toISOString()
};

describe("Hide and Seek encrypted round tokens", () => {
  beforeEach(() => {
    process.env.PUZZLE_SESSION_SECRET = "test-secret-that-is-longer-than-24-characters";
  });

  it("round-trips opaque active state without exposing the seed", () => {
    const activeToken = createHideAndSeekRoundToken(activeRound);

    expect(activeToken.startsWith("hs1.")).toBe(true);
    expect(activeToken).not.toContain(activeRound.seed);
    expect(readHideAndSeekRoundToken(activeToken, nowMs + 3_000)).toEqual(activeRound);
  });

  it("uses a fresh nonce and rejects ciphertext tampering", () => {
    expect(createHideAndSeekRoundToken(activeRound)).not.toBe(createHideAndSeekRoundToken(activeRound));
    const parts = createHideAndSeekRoundToken(activeRound).split(".");
    parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;

    expect(() => readHideAndSeekRoundToken(parts.join("."), nowMs + 3_000)).toThrow(/invalid/i);
  });

  it("enforces thirty-minute active expiries", () => {
    expect(() => readHideAndSeekRoundToken(
      createHideAndSeekRoundToken(activeRound),
      Date.parse(activeRound.expiresAt)
    )).toThrow(/round expired/i);

    expect(() => createHideAndSeekRoundToken({
      ...activeRound,
      expiresAt: new Date(Date.parse(activeRound.startedAt) + HIDE_AND_SEEK_ROUND_DURATION_MS + 1).toISOString()
    })).toThrow(/invalid/i);
  });

  it("can authenticate an expired active token before persistence replay checks", () => {
    const token = createHideAndSeekRoundToken(activeRound);
    const afterExpiry = Date.parse(activeRound.expiresAt) + 1;

    expect(readHideAndSeekRoundToken(token, afterExpiry, { allowExpired: true })).toEqual(activeRound);
    expect(() => readHideAndSeekRoundToken(token, afterExpiry)).toThrow(/expired/i);
  });

  it("binds the token to exactly one student", () => {
    expect(() => assertHideAndSeekTokenStudent(
      activeRound,
      "40000000-0000-4000-8000-000000000004"
    )).toThrow(/different student/i);
  });
});
