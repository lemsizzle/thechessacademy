import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { readStudentSession } from "@/lib/auth/session";
import { getSupabaseQuestTracking, saveSupabaseQuestTracking } from "@/lib/quests/supabaseQuestProgress";
import type { LichessQuestProgress, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function getAccess(request: Request) {
  const cookieStore = await cookies();
  const student = readStudentSession(cookieStore);
  const admin = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(request.headers.get("x-admin-action-token"));
  return { student, admin };
}

export async function GET(request: Request) {
  const { student, admin } = await getAccess(request);
  if (!student && !admin) return NextResponse.json({ error: "Log in required." }, { status: 401 });

  const result = await getSupabaseQuestTracking(admin ? undefined : student?.studentId);
  if (result.error) return NextResponse.json({ ...result, mode: "local-only" });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { student, admin } = await getAccess(request);
  if (!student && !admin) return NextResponse.json({ error: "Log in required." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    attempts?: StudentQuestAttempt[];
    progress?: LichessQuestProgress[];
    completions?: QuestCompletionEvent[];
  };
  const own = <T extends { studentId: string }>(items: T[] = []) => {
    if (admin) return items;
    if (!student) return [];
    return items.map((item) => ({ ...item, studentId: student.studentId }));
  };

  try {
    const result = await saveSupabaseQuestTracking({
      attempts: own(body.attempts),
      progress: own(body.progress),
      completions: own(body.completions)
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save quest progress.";
    return NextResponse.json({ ok: false, saved: false, mode: "local-only", error: message });
  }
}
