import { readStudentSession } from "@/lib/auth/session";
import { STUDENT_APP_SESSION_COOKIE } from "@/lib/auth/roles";
import { findSupabaseStudentById, findSupabaseStudentByLichess } from "@/lib/students/supabaseStudentProfiles";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  const byId = session?.studentId ? await findSupabaseStudentById(session.studentId) : { configured: false, student: null };
  const byLichess = session ? await findSupabaseStudentByLichess(session.lichessUserId, session.lichessUsername) : { configured: false, student: null };

  return NextResponse.json({
    studentSessionCookieExists: Boolean(cookieStore.get(STUDENT_APP_SESSION_COOKIE)?.value),
    sessionExists: Boolean(session),
    lichessUsername: session?.lichessUsername ?? null,
    linkedStudentId: session?.studentId ?? null,
    sessionOnboardingCompleted: session?.onboardingCompleted ?? null,
    supabaseConfigured: byId.configured || byLichess.configured,
    studentExistsBySessionId: Boolean(byId.student),
    studentExistsByLichess: Boolean(byLichess.student),
    resolvedStudentId: byId.student?.id ?? byLichess.student?.id ?? null,
    lookupError: byId.error ?? byLichess.error ?? null
  });
}
