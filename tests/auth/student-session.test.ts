import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { STUDENT_APP_SESSION_COOKIE } from "@/lib/auth/roles";
import { createStudentSession, readStudentSession, setStudentSessionCookie } from "@/lib/auth/session";

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
  it("round-trips a signed session", () => {
    const { session, value } = sessionCookie();
    expect(value).toContain(".");
    expect(readStudentSession({ get: () => ({ value }) })).toEqual(session);
  });

  it("rejects unsigned and tampered session payloads", () => {
    const { value } = sessionCookie();
    const [payload, signature] = value.split(".");
    expect(readStudentSession({ get: () => ({ value: payload }) })).toBeNull();
    expect(readStudentSession({ get: () => ({ value: `${payload.slice(0, -1)}A.${signature}` }) })).toBeNull();
    expect(readStudentSession({ get: () => ({ value: `${payload}.${signature.slice(0, -1)}A` }) })).toBeNull();
  });
});
