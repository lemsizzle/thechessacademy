import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { assessmentDb, assessmentReview } from "@/lib/assessment/server";
import { assessmentKey, publicQuestions } from "@/lib/assessment/questions";
import { ASSESSMENT_SECTIONS, knowledgePercent, type AssessmentAttempt } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";
export default async function AssessmentsPage() {
  const cookieStore = await cookies();
  if (!await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/admin-login");
  let results: (AssessmentAttempt & { name: string })[] = [];
  let unavailable = false;
  try {
    const db = assessmentDb();
    const { error: expiryError } = await db.rpc("finish_expired_chess_assessments", { p_key: assessmentKey() });
    if (expiryError) throw expiryError;
    const { data, error } = await db.from("student_chess_assessments").select("*").gte("correct_count", 0).order("started_at", { ascending: false }).limit(100);
    if (error) throw error;
    const attempts = (data ?? []) as AssessmentAttempt[];
    const ids = [...new Set(attempts.map(a => a.student_id))];
    const students = ids.length ? await db.from("students").select("id,display_name,lichess_username").in("id", ids) : { data: [], error: null };
    if (students.error) throw students.error;
    results = attempts.map(a => { const student = students.data?.find(s => s.id === a.student_id); return { ...a, name: student?.display_name || student?.lichess_username || "Student" }; });
  } catch { unavailable = true; }
  const questions = publicQuestions();
  return <AppShell variant="admin" title="Knowledge Assessments" subtitle="30 questions · 30 minutes · consistent Form A scoring across six chess topics.">
    <div className="space-y-5 rounded-xl border border-white/10 bg-slate-950/80 p-4 sm:p-6">
      <p className="text-sm text-slate-300">Latest 100 completed tests, newest first. Each topic is scored out of 5; the total is converted to a score out of 100. Retakes use the same questions, so use the first attempt as a baseline. These are knowledge scores, not Elo ratings.</p>
      {unavailable ? <p role="alert">Results could not be loaded. Please refresh to retry.</p> : !results.length ? <p>No completed tests yet. Students can open Train → Knowledge Test.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><caption className="sr-only">Student knowledge test results</caption><thead><tr>{["Student", "Started", "Score", ...ASSESSMENT_SECTIONS].map(title => <th className="border-b border-white/15 p-3" scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{results.map(attempt => {
        const review = assessmentReview(attempt);
        return <tr key={attempt.id}><th scope="row" className="border-b border-white/10 p-3 font-bold"><a className="text-cyan-200 underline" href={`/admin/students?student=${attempt.student_id}`}>{attempt.name}</a></th><td className="border-b border-white/10 p-3">{new Date(attempt.started_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} ICT</td><td className="border-b border-white/10 p-3 font-black">{knowledgePercent(attempt.correct_count ?? 0)}/100<span className="block font-normal text-slate-400">{attempt.correct_count}/30</span></td>{ASSESSMENT_SECTIONS.map(section => <td key={section} className="border-b border-white/10 p-3">{questions.filter(q => q.section === section && review.some(r => r.id === q.id && r.correct)).length}/5</td>)}</tr>;
      })}</tbody></table></div>}
    </div>
  </AppShell>;
}
