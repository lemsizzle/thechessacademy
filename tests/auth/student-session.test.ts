import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { STUDENT_APP_SESSION_COOKIE } from "@/lib/auth/roles";
import { createStudentSession, readStudentSession, sessionToStudentUser, setStudentSessionCookie } from "@/lib/auth/session";

function sessionCookie() {
  const session = createStudentSession({
    studentId: "f8a80000-0000-4800-8800-000000000003",
    name: "Session Test",
    lichessUserId: "session-test",
    lichessUsername: "SessionTest",
    onboardingCompleted: true
  });
  const response = NextResponse.json({ ok: true });
  setStudentSessionCookie(response, session);
  return { session, value: response.cookies.get(STUDENT_APP_SESSION_COOKIE)?.value ?? "" };
}

describe("student session cookies", () => {
  it("round-trips Academy sessions without a fake Lichess username", () => {
    const session = createStudentSession({ studentId: "11111111-1111-4111-8111-111111111111", name: "Learner", authProvider: "academy", academyUsername: "learner", onboardingCompleted: true });
    const response = NextResponse.json({}); setStudentSessionCookie(response, session);
    expect(readStudentSession({ get: () => response.cookies.get(STUDENT_APP_SESSION_COOKIE) })).toEqual(session);
    expect(sessionToStudentUser(session)).toMatchObject({ authProvider: "academy", academyUsername: "learner", email: "" });
    expect(sessionToStudentUser(session).lichessUsername).toBeUndefined();
  });
  it("rejects signed sessions with invalid expiry", () => {
    const { session } = sessionCookie(); session.expiresAt = "not-a-date";
    const response = NextResponse.json({}); setStudentSessionCookie(response, session);
    expect(readStudentSession({ get: () => response.cookies.get(STUDENT_APP_SESSION_COOKIE) })).toBeNull();
  });
  it("round-trips a signed session", () => {
    const { session, value } = sessionCookie();
    expect(value).toContain(".");
    expect(readStudentSession({ get: () => ({ value }) })).toEqual(session);
  });

  it("rejects unsigned and tampered session payloads", () => {
    const { value } = sessionCookie();
    const [payload, signature] = value.split(".");
    const tamperedSignature = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
    expect(readStudentSession({ get: () => ({ value: payload }) })).toBeNull();
    expect(readStudentSession({ get: () => ({ value: `${payload.slice(0, -1)}A.${signature}` }) })).toBeNull();
    expect(readStudentSession({ get: () => ({ value: `${payload}.${tamperedSignature}` }) })).toBeNull();
  });
});
