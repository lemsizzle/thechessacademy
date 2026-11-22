import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { assessmentDb, assessmentReview } from "@/lib/assessment/server";
import { assessmentKey, publicQuestions } from "@/lib/assessment/questions";
import { ASSESSMENT_VERSION, LEGACY_ASSESSMENT_VERSION, assessmentLabel, knowledgePercent, type AssessmentAttempt } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";
export default async function AssessmentsPage() {
  const cookieStore = await cookies();
  if (!await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/admin-login");
  let results: (AssessmentAttempt & { name: string })[] = [];
  let unavailable = false;
  try {
    const db = assessmentDb();
    for (const version of [LEGACY_ASSESSMENT_VERSION, ASSESSMENT_VERSION]) {
      const { error: expiryError } = await db.rpc("finish_expired_chess_assessments_v2", { p_key: assessmentKey(version), p_version: version });
      if (expiryError) throw expiryError;
    }
    const { data, error } = await db.from("student_chess_assessments").select("*").gte("correct_count", 0).order("started_at", { ascending: false }).limit(100);
    if (error) throw error;
    const attempts = (data ?? []) as AssessmentAttempt[];
    const ids = [...new Set(attempts.map(a => a.student_id))];
    const students = ids.length ? await db.from("students").select("id,display_name,lichess_username").in("id", ids) : { data: [], error: null };
    if (students.error) throw students.error;
    results = attempts.map(a => { const student = students.data?.find(s => s.id === a.student_id); return { ...a, name: student?.display_name || student?.lichess_username || "Student" }; });
  } catch { unavailable = true; }
  return <AppShell variant="admin" title="Chess Assessments" subtitle="30 positions · 30 minutes · students play their answers on the board.">
    <div className="space-y-5 rounded-xl border border-white/10 bg-slate-950/80 p-4 sm:p-6">
      <p className="text-sm text-slate-300">Latest 100 completed tests, newest first. Each topic is scored out of 5; the total is converted to a score out of 100. Compare scores only within the same form: Skills B uses board moves; Knowledge A is the original quiz. Retakes use the same positions. These scores are not Elo ratings.</p>
      {unavailable ? <p role="alert">Results could not be loaded. Please refresh to retry.</p> : !results.length ? <p>No completed tests yet. Students can open Train → Skills Test.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><caption className="sr-only">Student chess test results</caption><thead><tr>{["Student", "Form", "Started", "Score", "Topic breakdown", "Review"].map(title => <th className="border-b border-white/15 p-3" scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{results.map(attempt => {
        const review = assessmentReview(attempt);
        const questions=publicQuestions(attempt.version),sections=[...new Set(questions.map(q=>q.section))];
        return <tr key={attempt.id}><th scope="row" className="border-b border-white/10 p-3 font-bold"><a className="text-cyan-200 underline" href={`/admin/students?student=${attempt.student_id}`}>{attempt.name}</a></th><td className="border-b border-white/10 p-3">{assessmentLabel(attempt.version)}</td><td className="border-b border-white/10 p-3">{new Date(attempt.started_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} ICT</td><td className="border-b border-white/10 p-3 font-black">{knowledgePercent(attempt.correct_count ?? 0)}/100<span className="block font-normal text-slate-400">{attempt.correct_count}/30</span></td><td className="border-b border-white/10 p-3"><div className="grid gap-1 sm:grid-cols-2">{sections.map(section => <span key={section}>{section}: {questions.filter(q => q.section === section && review.some(r => r.id === q.id && r.correct)).length}/5</span>)}</div></td><td className="border-b border-white/10 p-3"><a className="font-bold text-cyan-200 underline" href={`/admin/assessments/${attempt.id}`}>Review test</a></td></tr>;
      })}</tbody></table></div>}
    </div>
  </AppShell>;
}
