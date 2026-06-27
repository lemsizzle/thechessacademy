import type { StudentGameSubmission, SubmissionReviewAction } from "@/lib/types";

export function reviewGameSubmission(submission: StudentGameSubmission, action: SubmissionReviewAction, teacherNote?: string) {
  return {
    ...submission,
    status: action === "approve" ? "approved" as const : action === "reject" ? "rejected" as const : "needs_changes" as const,
    reviewedAt: new Date().toISOString().slice(0, 10),
    reviewedBy: "Teacher",
    teacherNote,
    rejectionReason: action === "reject" ? teacherNote : submission.rejectionReason
  };
}
