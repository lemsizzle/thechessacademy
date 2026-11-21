import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { assessmentKey, assessmentForm, publicQuestions, validateAssessmentAnswers } from "./questions";
import { ASSESSMENT_VERSION, LEGACY_ASSESSMENT_VERSION, type AssessmentAttempt, type AssessmentPayload } from "./types";
import { assessmentMove } from "./moveAnswer";

export function assessmentDb() {
  const db = getSupabaseServiceClient();
  if (!db) throw new Error("Assessment storage unavailable");
  return db;
}
export function assessmentReview(attempt: Pick<AssessmentAttempt, "answers"> & { version?: string }) {
  return assessmentForm(attempt.version ?? LEGACY_ASSESSMENT_VERSION).map(q => {
    if ("acceptedMoves" in q) return { id: q.id, correct: q.acceptedMoves.includes(attempt.answers[q.id]), answer: q.acceptedMoves.map(move => assessmentMove(q.fen, move)!.san).join(" or "), explanation: q.explanation, move: q.acceptedMoves[0] };
    return { id: q.id, correct: attempt.answers[q.id] === q.answer, answer: q.answer, explanation: q.explanation };
  });
}
export async function saveAssessment(studentId: string, attemptId: string, answers: unknown, submit = false): Promise<AssessmentAttempt> {
  const db = assessmentDb();
  const { data: rows, error: readError } = await db.from("student_chess_assessments").select("version").eq("id", attemptId).eq("student_id", studentId).limit(1);
  if (readError || !rows?.[0]) throw new Error("Assessment unavailable");
  const version = rows[0].version as string;
  const patch = validateAssessmentAnswers(answers, version);
  const { data, error } = await db.rpc("save_chess_assessment_v2", { p_student_id: studentId, p_attempt_id: attemptId, p_answers: patch, p_submit: submit, p_key: assessmentKey(version), p_version: version });
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
  return { attempt, history: history ?? [], questions: publicQuestions(attempt?.version ?? ASSESSMENT_VERSION), ...(attempt?.completed_at ? { review: assessmentReview(attempt) } : {}), serverNow: new Date().toISOString() };
}
