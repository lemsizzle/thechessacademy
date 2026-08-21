import type { ReviewAnswerVisibility, ReviewAssignmentStatus } from "@/chess/analysis/types";

export const REVIEW_PROMPT_MAX = 2000;
export const REVIEW_ANSWER_MAX = 4000;
export const REVIEW_RESPONSE_MAX = 4000;
export const REVIEW_FEEDBACK_MAX = 4000;
export const REVIEW_ANSWER_VISIBILITIES = ["visible", "after_completion", "teacher_only"] as const;

export function parseReviewAssignmentInput(input: {
  studentId?: unknown;
  chapterId?: unknown;
  prompt?: unknown;
  teacherAnswer?: unknown;
  answerVisibility?: unknown;
}) {
  const studentId = String(input.studentId ?? "").trim();
  const chapterId = input.chapterId ? String(input.chapterId).trim() : null;
  const prompt = String(input.prompt ?? "").trim();
  const teacherAnswer = String(input.teacherAnswer ?? "").trim();
  if (input.answerVisibility !== undefined && !REVIEW_ANSWER_VISIBILITIES.includes(input.answerVisibility as ReviewAnswerVisibility)) {
    throw new Error("Invalid answer visibility.");
  }
  const answerVisibility = input.answerVisibility as ReviewAnswerVisibility | undefined ?? "after_completion";

  if (!isUuid(studentId)) throw new Error("Invalid student.");
  if (chapterId && !isUuid(chapterId)) throw new Error("Invalid chapter.");
  if (!prompt || prompt.length > REVIEW_PROMPT_MAX) throw new Error("Invalid review prompt.");
  if (teacherAnswer.length > REVIEW_ANSWER_MAX) throw new Error("Invalid teacher answer.");
  return { studentId, chapterId, prompt, teacherAnswer, answerVisibility };
}

export function reviewAnswerIsVisible(
  actorKind: "admin" | "student",
  visibility: ReviewAnswerVisibility,
  status: ReviewAssignmentStatus
) {
  if (actorKind === "admin") return true;
  if (visibility === "visible") return true;
  return visibility === "after_completion" && status !== "assigned";
}

export function parseStudentReviewResponse(value: unknown) {
  const response = String(value ?? "").trim();
  if (!response || response.length > REVIEW_RESPONSE_MAX) throw new Error("Invalid student response.");
  return response;
}

export function parseTeacherReviewDecision(input: { decision?: unknown; teacherFeedback?: unknown }) {
  const decision = input.decision;
  if (decision !== "approve" && decision !== "return" && decision !== "reset") throw new Error("Invalid review decision.");
  const teacherFeedback = String(input.teacherFeedback ?? "").trim();
  if (teacherFeedback.length > REVIEW_FEEDBACK_MAX) throw new Error("Invalid teacher feedback.");
  if (decision === "return" && !teacherFeedback) throw new Error("Feedback is required when returning a review.");
  return { decision, teacherFeedback };
}

export function reviewStatusAllowsSubmission(status: ReviewAssignmentStatus) {
  return status === "assigned" || status === "returned";
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
