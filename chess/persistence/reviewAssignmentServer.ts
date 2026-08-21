import "server-only";

import type { ChessActor } from "@/lib/auth/requireChessActor";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getChapter, requireStudyAccess } from "@/chess/persistence/studyServer";
import {
  REVIEW_ANSWER_MAX,
  REVIEW_ANSWER_VISIBILITIES,
  REVIEW_PROMPT_MAX,
  isUuid,
  parseReviewAssignmentInput,
  parseStudentReviewResponse,
  parseTeacherReviewDecision,
  reviewStatusAllowsSubmission,
  reviewAnswerIsVisible
} from "@/chess/analysis/reviewAssignments";
import type { ReviewAnswerVisibility, ReviewAssignment, ReviewAssignmentStatus } from "@/chess/analysis/types";

type AssignmentRow = {
  id: string;
  study_id: string;
  chapter_id: string | null;
  student_id: string;
  prompt: string;
  teacher_answer: string;
  answer_visibility: ReviewAnswerVisibility;
  student_response: string;
  teacher_feedback: string;
  status: ReviewAssignmentStatus;
  assigned_at: string;
  completed_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Chess review storage is not configured.");
  return supabase;
}

function requireTeacher(actor: ChessActor) {
  if (actor.kind !== "admin") throw new Error("Teacher permission is required.");
}

async function loadAssignment(assignmentId: string) {
  if (!isUuid(assignmentId)) throw new Error("Invalid review assignment.");
  const { data, error } = await client().from("chess_review_assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Review assignment not found.");
  return data as AssignmentRow;
}

async function enrichAssignments(actor: ChessActor, rows: AssignmentRow[]): Promise<ReviewAssignment[]> {
  if (!rows.length) return [];
  const studyIds = [...new Set(rows.map((row) => row.study_id))];
  const chapterIds = [...new Set(rows.flatMap((row) => row.chapter_id ? [row.chapter_id] : []))];
  const studentIds = [...new Set(rows.map((row) => row.student_id))];
  const supabase = client();
  const [studyResult, chapterResult, studentResult] = await Promise.all([
    supabase.from("chess_studies").select("id,title").in("id", studyIds),
    chapterIds.length ? supabase.from("chess_study_chapters").select("id,title").in("id", chapterIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("students").select("id,display_name").in("id", studentIds)
  ]);
  if (studyResult.error) throw new Error(studyResult.error.message);
  if (chapterResult.error) throw new Error(chapterResult.error.message);
  if (studentResult.error) throw new Error(studentResult.error.message);
  const studies = new Map((studyResult.data ?? []).map((row) => [String(row.id), String(row.title)]));
  const chapters = new Map((chapterResult.data ?? []).map((row) => [String(row.id), String(row.title)]));
  const students = new Map((studentResult.data ?? []).map((row) => [String(row.id), String(row.display_name)]));

  return rows.map((row) => {
    const answerRevealed = reviewAnswerIsVisible(actor.kind, row.answer_visibility, row.status);
    return {
      id: row.id,
      studyId: row.study_id,
      chapterId: row.chapter_id,
      studentId: row.student_id,
      studentName: students.get(row.student_id) ?? "Student",
      studyTitle: studies.get(row.study_id) ?? "Chess Study",
      chapterTitle: row.chapter_id ? chapters.get(row.chapter_id) ?? "Study chapter" : null,
      prompt: row.prompt,
      ...(answerRevealed && row.teacher_answer ? { teacherAnswer: row.teacher_answer } : {}),
      hasTeacherAnswer: Boolean(row.teacher_answer),
      answerVisibility: row.answer_visibility,
      answerRevealed,
      studentResponse: row.student_response,
      teacherFeedback: row.teacher_feedback,
      status: row.status,
      assignedAt: row.assigned_at,
      submittedAt: row.completed_at,
      reviewedAt: row.reviewed_at,
      updatedAt: row.updated_at
    };
  });
}

export async function listReviewAssignments(actor: ChessActor, studyId?: string) {
  if (studyId) {
    if (!isUuid(studyId)) throw new Error("Invalid study.");
    await requireStudyAccess(actor, studyId);
  }
  let query = client().from("chess_review_assignments").select("*").order("assigned_at", { ascending: false }).limit(500);
  if (studyId) query = query.eq("study_id", studyId);
  if (actor.kind === "student") query = query.eq("student_id", actor.studentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return enrichAssignments(actor, (data ?? []) as AssignmentRow[]);
}

export async function createReviewAssignment(actor: ChessActor, input: {
  studyId?: unknown;
  studentId?: unknown;
  chapterId?: unknown;
  prompt?: unknown;
  teacherAnswer?: unknown;
  answerVisibility?: unknown;
}) {
  requireTeacher(actor);
  const studyId = String(input.studyId ?? "").trim();
  if (!isUuid(studyId)) throw new Error("Invalid study.");
  const parsed = parseReviewAssignmentInput(input);
  const { study } = await requireStudyAccess(actor, studyId, false, true);
  if (parsed.chapterId) await getChapter(actor, studyId, parsed.chapterId);
  const supabase = client();
  const { data: student, error: studentError } = await supabase.from("students").select("id").eq("id", parsed.studentId).eq("is_active", true).maybeSingle();
  if (studentError) throw new Error(studentError.message);
  if (!student) throw new Error("Student not found.");

  let duplicateQuery = supabase.from("chess_review_assignments").select("id").eq("study_id", studyId).eq("student_id", parsed.studentId);
  duplicateQuery = parsed.chapterId ? duplicateQuery.eq("chapter_id", parsed.chapterId) : duplicateQuery.is("chapter_id", null);
  const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
  if (duplicateError) throw new Error(duplicateError.message);
  if (duplicate) throw new Error("This review has already been assigned to that student.");

  const now = new Date().toISOString();
  const { data, error } = await supabase.from("chess_review_assignments").insert({
    study_id: studyId,
    chapter_id: parsed.chapterId,
    student_id: parsed.studentId,
    prompt: parsed.prompt,
    teacher_answer: parsed.teacherAnswer,
    answer_visibility: parsed.answerVisibility,
    status: "assigned",
    completed_at: null,
    updated_at: now
  }).select("*").single();
  if (error) throw new Error(error.message);

  let createdMembership = false;
  try {
    if (study.owner_student_id !== parsed.studentId) {
      const { data: membership, error: memberReadError } = await supabase.from("chess_study_members").select("role")
        .eq("study_id", studyId).eq("student_id", parsed.studentId).maybeSingle();
      if (memberReadError) throw new Error(memberReadError.message);
      if (!membership) {
        const { error: memberError } = await supabase.from("chess_study_members").insert({ study_id: studyId, student_id: parsed.studentId, role: "viewer" });
        if (memberError) throw new Error(memberError.message);
        createdMembership = true;
      }
    }
    const { error: visibilityError } = await supabase.from("chess_studies").update({ visibility: "shared", updated_at: now }).eq("id", studyId);
    if (visibilityError) throw new Error(visibilityError.message);
  } catch (cause) {
    await supabase.from("chess_review_assignments").delete().eq("id", String((data as AssignmentRow).id));
    if (createdMembership) await supabase.from("chess_study_members").delete().eq("study_id", studyId).eq("student_id", parsed.studentId).eq("role", "viewer");
    throw cause;
  }
  return (await enrichAssignments(actor, [data as AssignmentRow]))[0];
}

export async function updateReviewAssignment(actor: ChessActor, assignmentId: string, input: {
  studentResponse?: unknown;
  decision?: unknown;
  teacherFeedback?: unknown;
  prompt?: unknown;
  teacherAnswer?: unknown;
  answerVisibility?: unknown;
}) {
  const row = await loadAssignment(assignmentId);
  if (actor.kind === "student" && row.student_id !== actor.studentId) throw new Error("You do not have permission to update this review.");
  if (actor.kind === "admin") await requireStudyAccess(actor, row.study_id, false, true);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (actor.kind === "student") {
    if (!reviewStatusAllowsSubmission(row.status)) throw new Error("This review cannot be submitted in its current state.");
    patch.student_response = parseStudentReviewResponse(input.studentResponse);
    patch.status = "submitted";
    patch.completed_at = new Date().toISOString();
    patch.reviewed_at = null;
  } else {
    if (input.prompt !== undefined) {
      const prompt = String(input.prompt).trim();
      if (!prompt || prompt.length > REVIEW_PROMPT_MAX) throw new Error("Invalid review prompt.");
      patch.prompt = prompt;
    }
    if (input.teacherAnswer !== undefined) {
      const answer = String(input.teacherAnswer).trim();
      if (answer.length > REVIEW_ANSWER_MAX) throw new Error("Invalid teacher answer.");
      patch.teacher_answer = answer;
    }
    if (input.answerVisibility !== undefined) {
      if (!REVIEW_ANSWER_VISIBILITIES.includes(input.answerVisibility as ReviewAnswerVisibility)) throw new Error("Invalid answer visibility.");
      patch.answer_visibility = input.answerVisibility;
    }
    if (input.decision !== undefined) {
      const decision = parseTeacherReviewDecision(input);
      if (decision.decision === "reset") {
        patch.status = "assigned";
        patch.student_response = "";
        patch.teacher_feedback = "";
        patch.completed_at = null;
        patch.reviewed_at = null;
      } else {
        if (row.status !== "submitted") throw new Error("Only a submitted review can be approved or returned.");
        patch.status = decision.decision === "approve" ? "approved" : "returned";
        patch.teacher_feedback = decision.teacherFeedback;
        patch.reviewed_at = new Date().toISOString();
      }
    }
  }
  if (Object.keys(patch).length === 1) throw new Error("No review changes were provided.");
  const { data, error } = await client().from("chess_review_assignments").update(patch).eq("id", assignmentId).select("*").single();
  if (error) throw new Error(error.message);
  return (await enrichAssignments(actor, [data as AssignmentRow]))[0];
}

export async function deleteReviewAssignment(actor: ChessActor, assignmentId: string) {
  requireTeacher(actor);
  const row = await loadAssignment(assignmentId);
  await requireStudyAccess(actor, row.study_id, false, true);
  const { error } = await client().from("chess_review_assignments").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);
}
