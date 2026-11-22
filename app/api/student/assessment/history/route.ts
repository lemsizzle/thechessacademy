import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { assessmentDb } from "@/lib/assessment/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const teacher = await isAuthorizedAdminRequest(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"));
    const requested = request.nextUrl.searchParams.get("studentId");
    const session = teacher ? null : await requireActiveStudent();
    const studentId = requested || session?.studentId;
    if (!teacher && studentId !== session!.studentId) return NextResponse.json({ error: "These results are private." }, { status: 403, headers });
    const page = Number(request.nextUrl.searchParams.get("page") || 1);
    if (!studentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId) || !Number.isInteger(page) || page < 1 || page > 10000) return NextResponse.json({ error: "Invalid student or page." }, { status: 400, headers });
    const { data, error } = await assessmentDb().from("student_chess_assessments")
      .select("id,version,started_at,completed_at,correct_count")
      .eq("student_id", studentId).gte("correct_count", 0)
      .order("started_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * 10, page * 10);
    if (error) throw error;
    const results = (data ?? []).slice(0, 10).map(({ id, version, started_at, completed_at, correct_count }) => ({ id, version, started_at, completed_at, correct_count }));
    return NextResponse.json({ results, hasMore: (data?.length ?? 0) > 10, reviewBase: teacher ? "/admin/assessments" : "/student/training/assessment" }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof StudentAuthenticationError ? "Please log in to view test results." : "Test results could not be loaded. Please retry." }, { status: error instanceof StudentAuthenticationError ? 401 : 503, headers });
  }
}
