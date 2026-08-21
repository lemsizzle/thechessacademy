import { STUDENT_APP_SESSION_COOKIE } from "@/lib/auth/roles";
import type { StudentSession, StudentUser } from "@/lib/types";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function sessionSecret() {
  const secret = process.env.STUDENT_SESSION_SECRET?.trim()
    || process.env.LICHESS_ENCRYPTION_SECRET?.trim()
    || process.env.PUZZLE_SESSION_SECRET?.trim()
    || process.env.ADMIN_SESSION_SECRET?.trim();
  if (secret && secret.length >= 24) return secret;
  if (process.env.NODE_ENV !== "production") return "chess-academy-local-session-secret";
  throw new Error("STUDENT_SESSION_SECRET must be configured with at least 24 characters.");
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function signedValue(session: StudentSession) {
  const payload = encode(session);
  return `${payload}.${signature(payload)}`;
}

function verifiedSession(value: string) {
  const separator = value.lastIndexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;
  const payload = value.slice(0, separator);
  const provided = Buffer.from(value.slice(separator + 1), "base64url");
  const expected = Buffer.from(signature(payload), "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  return decode<StudentSession>(payload);
}

export function createStudentSession(input: Omit<StudentSession, "id" | "role" | "createdAt" | "expiresAt">): StudentSession {
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MAX_AGE * 1000);
  return {
    ...input,
    id: crypto.randomUUID(),
    role: "student",
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString()
  };
}

export function setStudentSessionCookie(response: NextResponse, session: StudentSession) {
  response.cookies.set(STUDENT_APP_SESSION_COOKIE, signedValue(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
}

export function clearStudentSessionCookie(response: NextResponse) {
  response.cookies.delete(STUDENT_APP_SESSION_COOKIE);
}

export function readStudentSession(cookieStore: { get: (name: string) => { value: string } | undefined }): StudentSession | null {
  const raw = cookieStore.get(STUDENT_APP_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = verifiedSession(raw);
  if (!session || session.role !== "student") return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return session;
}

export function sessionToStudentUser(session: StudentSession): StudentUser {
  return {
    id: `lichess-session-${session.lichessUserId}`,
    studentId: session.studentId,
    name: session.name,
    email: `${session.lichessUsername}@lichess.local`,
    role: "student",
    lichessUsername: session.lichessUsername,
    onboardingCompleted: session.onboardingCompleted
  };
}
