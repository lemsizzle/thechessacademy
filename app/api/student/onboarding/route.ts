import { rememberKnownLichessStudent } from "@/lib/auth/knownLichessStudents";
import { readStudentSession, setStudentSessionCookie } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  if (!session) return NextResponse.json({ error: "Student log in required." }, { status: 401 });

  const input = await request.json().catch(() => ({})) as { displayName?: string; classGroup?: string };
  const displayName = input.displayName?.trim();
  const classGroup = input.classGroup?.trim();
  if (!displayName || !classGroup) return NextResponse.json({ error: "Display name and class group are required." }, { status: 400 });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: `lichess-session-${session.lichessUserId}`,
      studentId: session.studentId,
      name: displayName,
      email: `${session.lichessUsername}@lichess.local`,
      role: "student",
      lichessUsername: session.lichessUsername,
      onboardingCompleted: true
    }
  });
  setStudentSessionCookie(response, { ...session, name: displayName, onboardingCompleted: true });
  rememberKnownLichessStudent(response, cookieStore, {
    id: session.studentId,
    slug: session.lichessUsername.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    lichessUsername: session.lichessUsername,
    name: displayName,
    avatar: displayName.slice(0, 1).toUpperCase(),
    classGroup,
    isActive: true,
    onboardingCompleted: true,
    totalXp: 0,
    badgeIds: [],
    completedQuestIds: [],
    encouragement: "Welcome to the academy. Your Lichess account is linked and your quest board is ready."
  }, session.lichessUserId, session.lichessUsername);
  return response;
}
