import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { assessmentKey, KNOWLEDGE_FORM_A, publicQuestions } from "./questions";
import { ASSESSMENT_VERSION, type AssessmentAttempt, type AssessmentPayload } from "./types";

export function assessmentDb() {
  const db = getSupabaseServiceClient();
  if (!db) throw new Error("Assessment storage unavailable");
  return db;
}
export function assessmentReview(attempt: Pick<AssessmentAttempt, "answers">) {
  return KNOWLEDGE_FORM_A.map(q => ({ id: q.id, correct: attempt.answers[q.id] === q.answer, answer: q.answer, explanation: q.explanation }));
}
export async function saveAssessment(studentId: string, attemptId: string, answers: Record<string, string>, submit = false): Promise<AssessmentAttempt> {
  const { data, error } = await assessmentDb().rpc("save_chess_assessment", { p_student_id: studentId, p_attempt_id: attemptId, p_answers: answers, p_submit: submit, p_key: assessmentKey() });
  if (error || !data) throw new Error("Assessment could not be saved");
  return (Array.isArray(data) ? data[0] : data) as AssessmentAttempt;
}
export async function startAssessment(studentId: string): Promise<AssessmentAttempt> {
  const { data, error } = await assessmentDb().rpc("start_chess_assessment", { p_student_id: studentId, p_version: ASSESSMENT_VERSION });
  if (error || !data) throw new Error("Assessment could not be started");
  return (Array.isArray(data) ? data[0] : data) as AssessmentAttempt;
}
export async function assessmentPayload(studentId: string, current?: AssessmentAttempt, attemptId?: string): Promise<AssessmentPayload> {
  const db = assessmentDb();
  let attempt = current ?? null;
  if (!current) {
    let query = db.from("student_chess_assessments").select("*").eq("student_id", studentId);
    if (attemptId) query = query.eq("id", attemptId);
    else query = query.is("completed_at", null);
    const { data, error } = await query.order("started_at", { ascending: false }).limit(1);
    if (error) throw error;
    attempt = data?.[0] ?? null;
  }
  if (attempt && !attempt.completed_at && Date.parse(attempt.deadline_at) <= Date.now()) attempt = await saveAssessment(studentId, attempt.id, {}, true);
  const { data: history, error } = await db.from("student_chess_assessments").select("id,version,started_at,deadline_at,completed_at,correct_count").eq("student_id", studentId).order("started_at", { ascending: false }).limit(30);
  if (error) throw error;
  return { attempt, history: history ?? [], questions: publicQuestions(), ...(attempt?.completed_at ? { review: assessmentReview(attempt) } : {}), serverNow: new Date().toISOString() };
}
