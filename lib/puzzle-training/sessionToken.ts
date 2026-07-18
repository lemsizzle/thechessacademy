import { createHmac, timingSafeEqual } from "node:crypto";
import type { PuzzleThemeSlug } from "@/lib/puzzle-training/types";

export type PuzzleSessionToken = {
  version: 1;
  puzzleId: string;
  studentId: string;
  sessionId: string;
  selectedTheme: PuzzleThemeSlug;
  nextMoveIndex: number;
  startedAt: string;
  incorrectMoveCount: number;
  hintsUsed: number;
};

function tokenSecret() {
  const value = process.env.PUZZLE_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 24) throw new Error("PUZZLE_SESSION_SECRET must be configured with at least 24 characters.");
  return value;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", tokenSecret()).update(encodedPayload).digest("base64url");
}

export function createPuzzleSessionToken(payload: PuzzleSessionToken) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readPuzzleSessionToken(token: string) {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) throw new Error("Invalid puzzle session token.");
  const expected = Buffer.from(sign(encoded));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("Invalid puzzle session token signature.");

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PuzzleSessionToken;
  if (payload.version !== 1 || !payload.puzzleId || !payload.studentId || !payload.sessionId) throw new Error("Invalid puzzle session token payload.");
  return payload;
}

export function assertPuzzleTokenStudent(payload: PuzzleSessionToken, studentId: string) {
  if (payload.studentId !== studentId) throw new Error("Puzzle session does not belong to this student.");
}
