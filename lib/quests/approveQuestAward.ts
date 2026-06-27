import type { PendingQuestAward, QuestCompletionEvent } from "@/lib/types";

export function approveQuestAward(award: PendingQuestAward) {
  const approved = { ...award, status: "approved" as const, reviewedAt: new Date().toISOString(), reviewedBy: "teacher" };
  const completion: QuestCompletionEvent = {
    id: `quest-completion-${award.id}`,
    studentId: award.studentId,
    questId: award.questId,
    awardId: award.id,
    completedAt: approved.reviewedAt,
    source: award.source,
    sourcePeriodStart: award.sourcePeriodStart,
    sourcePeriodEnd: award.sourcePeriodEnd,
    xpAwarded: award.xpAmount,
    badgeAwardedId: award.badgeId,
    evidence: award.evidence
  };
  return { award: approved, completion };
}
