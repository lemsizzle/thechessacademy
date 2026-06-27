import type { StudentScoreSubmission } from "@/lib/types";

export function createScoreSubmission(input: Omit<StudentScoreSubmission, "id" | "status" | "submittedAt">) {
  if (!input.challengeName.trim()) return { ok: false as const, error: "Add a challenge name." };
  if (input.score < 0) return { ok: false as const, error: "Score cannot be negative." };

  const submission: StudentScoreSubmission = {
    ...input,
    id: `student-score-${input.studentId}-${Date.now()}`,
    status: "pending",
    submittedAt: new Date().toISOString().slice(0, 10)
  };
  return { ok: true as const, submission };
}
