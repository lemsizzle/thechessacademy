import type { PendingTournamentAward } from "@/lib/types";

export function rejectTournamentAward(award: PendingTournamentAward, rejectionReason = "", teacherNote = "") {
  return {
    ...award,
    teacherNote: teacherNote.trim() || undefined,
    rejectionReason: rejectionReason.trim() || "Not approved by teacher.",
    status: "rejected" as const,
    reviewedAt: new Date().toISOString(),
    reviewedBy: "teacher"
  };
}
