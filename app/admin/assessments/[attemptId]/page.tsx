import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TeacherAssessmentReview } from "@/components/training/TeacherAssessmentReview";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { assessmentDb, assessmentAnalysisQuestions } from "@/lib/assessment/server";
import { assessmentLabel, knowledgePercent, type AssessmentAttempt } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";
export default async function AssessmentReviewPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const cookieStore = await cookies();
  if (!await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/admin-login");
  const { attemptId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) notFound();
  const db = assessmentDb();
  const { data, error } = await db.from("student_chess_assessments").select("*").eq("id", attemptId).limit(1);
  if (error) throw new Error("Test review could not be loaded. Please retry.");
  const attempt = data?.[0] as AssessmentAttempt | undefined;
  if (!attempt?.completed_at) notFound();
  const { data: students, error: studentError } = await db.from("students").select("display_name,lichess_username").eq("id", attempt.student_id).limit(1);
  if (studentError) throw new Error("Student details could not be loaded. Please retry.");
  const name = students?.[0]?.display_name || students?.[0]?.lichess_username || "Student";
  const questions = assessmentAnalysisQuestions(attempt);
  return <AppShell variant="admin" title={`${name} · Test review`} subtitle={`${assessmentLabel(attempt.version)} · ${knowledgePercent(attempt.correct_count ?? 0)}/100 · ${attempt.correct_count}/30 correct`}>
    <div className="mb-4"><Link href="/admin/assessments" className="text-sm font-bold text-cyan-200 underline">← All test results</Link></div>
    <TeacherAssessmentReview questions={questions} />
  </AppShell>;
}
