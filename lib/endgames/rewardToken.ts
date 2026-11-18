import "server-only";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { ENDGAME_TOPICS } from "./catalog";

export class EndgameInputError extends Error {}
export type EndgameRewardToken = { version: 1; studentId: string; id: string; topicId: string; seed: number; expiresAt: number };
function signature(payload: string) {
  const secret = process.env.STUDENT_SESSION_SECRET?.trim() || process.env.LICHESS_ENCRYPTION_SECRET?.trim() || process.env.PUZZLE_SESSION_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 24) throw new Error("Student session signing is unavailable.");
  return createHmac("sha256", secret).update(`chessquest:endgame-reward:v1:${payload}`).digest();
}
export function createEndgameRewardToken(studentId: string, topicId: string, now = Date.now()) {
  if (!ENDGAME_TOPICS.some(topic => topic.id === topicId)) throw new EndgameInputError("Choose an endgame skill.");
  const data: EndgameRewardToken = { version: 1, studentId, id: randomUUID(), topicId, seed: randomBytes(4).readUInt32BE(0), expiresAt: now + 7 * 24 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return { token: `${payload}.${signature(payload).toString("base64url")}`, seed: data.seed };
}
export function readEndgameRewardToken(value: unknown, studentId: string, now = Date.now()): EndgameRewardToken {
  if (typeof value !== "string" || value.length > 2048) throw new EndgameInputError("Start a new position to earn rewards.");
  const [payload, supplied, extra] = value.split(".");
  if (!payload || !supplied || extra) throw new EndgameInputError("Invalid practice session.");
  const expected = signature(payload), actual = Buffer.from(supplied, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new EndgameInputError("Invalid practice session.");
  let data: EndgameRewardToken;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw new EndgameInputError("Invalid practice session."); }
  if (!data || data.version !== 1 || data.studentId !== studentId || !Number.isSafeInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff || !Number.isFinite(data.expiresAt) || !ENDGAME_TOPICS.some(topic => topic.id === data.topicId) || !/^[a-f0-9-]{36}$/.test(data.id)) throw new EndgameInputError("Invalid practice session.");
  if (data.expiresAt <= now) throw new EndgameInputError("This practice reward session expired. Start a new position to earn rewards.");
  return data;
}
