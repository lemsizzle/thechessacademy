import { rememberKnownLichessStudent } from "@/lib/auth/knownLichessStudents";
import { readStudentSession, setStudentSessionCookie } from "@/lib/auth/session";
import { createSupabaseStudentForLichess } from "@/lib/students/supabaseStudentProfiles";
import { isSupabaseServiceConfigured } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  if (!session) return NextResponse.json({ error: "Student log in required." }, { status: 401 });

  const input = await request.json().catch(() => ({})) as { displayName?: string; classGroup?: string };
  const displayName = input.displayName?.trim();
  const classGroup = input.classGroup?.trim();
  if (!displayName || !classGroup) return NextResponse.json({ error: "Display name and class group are required." }, { status: 400 });

  let student: Student;
  try {
    student = isSupabaseServiceConfigured()
      ? await createSupabaseStudentForLichess(session, { displayName, classGroup })
      : {
        id: session.studentId,
        slug: session.lichessUsername.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
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
      };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create Supabase student profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const updatedSession = {
    ...session,
    studentId: student.id,
    name: student.name,
    onboardingCompleted: true
  };

  const response = NextResponse.json({
    ok: true,
    user: {
      id: `lichess-session-${session.lichessUserId}`,
      studentId: student.id,
      name: student.name,
      email: `${session.lichessUsername}@lichess.local`,
      role: "student",
      lichessUsername: session.lichessUsername,
      onboardingCompleted: true
    },
    student,
    redirectTo: "/student/profile"
  });
  setStudentSessionCookie(response, updatedSession);
  rememberKnownLichessStudent(response, cookieStore, student, session.lichessUserId, session.lichessUsername);
  return response;
}
