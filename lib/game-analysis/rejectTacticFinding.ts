import type { GameTacticFinding } from "@/lib/types";

export function rejectTacticFinding(finding: GameTacticFinding, rejectionReason = "Rejected after teacher review."): GameTacticFinding {
  return {
    ...finding,
    status: "rejected",
    reviewedAt: new Date().toISOString().slice(0, 10),
    reviewedBy: "Teacher",
    rejectionReason
  };
}
