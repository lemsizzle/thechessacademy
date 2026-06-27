import { createStudentSession, readStudentSession, sessionToStudentUser, setStudentSessionCookie } from "@/lib/auth/session";
import { findSupabaseStudentById, findSupabaseStudentByLichess } from "@/lib/students/supabaseStudentProfiles";
import { isSupabaseProjectConfigured } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = readStudentSession(await cookies());
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const byId = session.onboardingCompleted ? await findSupabaseStudentById(session.studentId) : { configured: false, student: null };
  const linked = byId.student ? byId : await findSupabaseStudentByLichess(session.lichessUserId, session.lichessUsername);

  if (linked.configured) {
    const repairedSession = createStudentSession({
      studentId: linked.student?.id ?? `pending-${session.lichessUserId}`,
      name: linked.student?.name ?? session.name,
      lichessUserId: session.lichessUserId,
      lichessUsername: session.lichessUsername,
      onboardingCompleted: Boolean(linked.student)
    });
    const response = NextResponse.json({
      user: sessionToStudentUser(repairedSession),
      session: { studentId: repairedSession.studentId, onboardingCompleted: repairedSession.onboardingCompleted },
      studentExists: Boolean(linked.student)
    }, { status: linked.student ? 200 : 200 });
    setStudentSessionCookie(response, repairedSession);
    return response;
  }

  if (process.env.NODE_ENV === "production" || isSupabaseProjectConfigured()) {
    return NextResponse.json({
      user: null,
      session: { studentId: session.studentId, onboardingCompleted: false },
      studentExists: false,
      error: "Student profiles require Supabase in production."
    }, { status: 503 });
  }

  return NextResponse.json({ user: sessionToStudentUser(session), session: { studentId: session.studentId, onboardingCompleted: session.onboardingCompleted } });
}
