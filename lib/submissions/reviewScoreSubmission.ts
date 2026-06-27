import type { StudentScoreSubmission, SubmissionReviewAction } from "@/lib/types";

export function reviewScoreSubmission(submission: StudentScoreSubmission, action: SubmissionReviewAction, teacherNote?: string, xpAwarded = 0, tacticProgressAdded = 0) {
  return {
    ...submission,
    status: action === "approve" ? "approved" as const : action === "reject" ? "rejected" as const : "needs_changes" as const,
    reviewedAt: new Date().toISOString().slice(0, 10),
    reviewedBy: "Teacher",
    teacherNote,
    rejectionReason: action === "reject" ? teacherNote : submission.rejectionReason,
    xpAwarded: action === "approve" ? xpAwarded : submission.xpAwarded,
    tacticProgressAdded: action === "approve" ? tacticProgressAdded : submission.tacticProgressAdded
  };
}
