import { readStudentSession, sessionToStudentUser } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = readStudentSession(await cookies());
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: sessionToStudentUser(session), session: { studentId: session.studentId, onboardingCompleted: session.onboardingCompleted } });
}
