import { authenticateAcademyStudent } from "@/lib/auth/studentCredentials";
import { allowAcademyLoginAttempt } from "@/lib/auth/academyLoginThrottle";
import { createStudentSession, setStudentSessionCookie } from "@/lib/auth/session";
import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const fail = (status = 401) => NextResponse.json({ error: "Invalid username or password." }, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const incoming = new URL(request.url);
      const expectedHost = request.headers.get("host") ?? incoming.host;
      const expectedProtocol = request.headers.get("x-forwarded-proto") ?? incoming.protocol.slice(0, -1);
      const source = new URL(origin);
      if (source.host !== expectedHost || source.protocol !== `${expectedProtocol}:`) return fail(403);
    } catch { return fail(403); }
  }
  if (Number(request.headers.get("content-length")) > 4096) return fail(413);
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowAcademyLoginAttempt(ip)) return fail(429);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return fail(413);
    let body;
    try { body = JSON.parse(raw); } catch { return fail(); }
    if (!body || typeof body.username !== "string" || typeof body.password !== "string") return fail();
    const student = await authenticateAcademyStudent(body.username, body.password);
    if (!student) return fail();
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    setStudentSessionCookie(response, createStudentSession({
      authProvider: "academy", academyUsername: student.username,
      studentId: student.studentId, name: student.displayName, onboardingCompleted: true
    }));
    // A shared computer must not retain the previous student's OAuth token.
    response.cookies.delete(LICHESS_TOKEN_COOKIE);
    return response;
  } catch {
    return NextResponse.json({ error: "Could not log in right now. Please try again." }, { status: 503 });
  }
}
