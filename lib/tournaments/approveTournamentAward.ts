import type { PendingTournamentAward } from "@/lib/types";

export function approveTournamentAward(award: PendingTournamentAward, xpAmount = award.xpAmount, teacherNote = "") {
  return {
    ...award,
    xpAmount: Math.max(0, xpAmount),
    teacherNote: teacherNote.trim() || undefined,
    status: "approved" as const,
    reviewedAt: new Date().toISOString(),
    reviewedBy: "teacher"
  };
}
