import { notFound } from "next/navigation";
import Link from "next/link";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { TeacherAssessmentReview } from "@/components/training/TeacherAssessmentReview";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";
import { assessmentAnalysisQuestions, assessmentDb } from "@/lib/assessment/server";
import { assessmentLabel, knowledgePercent, type AssessmentAttempt } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";
export default async function StudentAssessmentAnalysisPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const student = await requireStudentPage();
  const { attemptId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) notFound();
  const { data, error } = await assessmentDb().from("student_chess_assessments").select("*").eq("id", attemptId).eq("student_id", student.studentId).gte("correct_count", 0).limit(1);
  if (error) throw new Error("Your test review could not be loaded. Please retry.");
  const attempt = data?.[0] as AssessmentAttempt | undefined;
  if (!attempt?.completed_at) notFound();
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Your test review" subtitle={`${assessmentLabel(attempt.version)} · ${knowledgePercent(attempt.correct_count ?? 0)}/100 · ${attempt.correct_count}/30 correct`} disableAutomaticLichessSync>
    <div className="mb-4"><Link className="text-sm font-bold text-cyan-200 underline" href="/student#test-results">← Your test results</Link></div>
    <TeacherAssessmentReview questions={assessmentAnalysisQuestions(attempt)} />
  </StudentPortalShell>;
}
