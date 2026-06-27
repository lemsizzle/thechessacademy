import type { PendingQuestAward } from "@/lib/types";

export function rejectQuestAward(award: PendingQuestAward, rejectionReason = "") {
  return {
    ...award,
    status: "rejected" as const,
    reviewedAt: new Date().toISOString(),
    reviewedBy: "teacher",
    rejectionReason: rejectionReason.trim() || "Not approved by teacher."
  };
}
