import type { PendingQuestAward, Quest, QuestCompletionEvent } from "@/lib/types";

export function questAwardId(studentId: string, questId: string, periodStart: string) {
  return `quest-award-${studentId}-${questId}-${periodStart.slice(0, 10)}`;
}

export function canCreateQuestAward(
  studentId: string,
  quest: Quest,
  periodStart: string,
  pending: PendingQuestAward[],
  completions: QuestCompletionEvent[]
) {
  const duplicate = pending.some((award) => (
    award.studentId === studentId
    && award.questId === quest.id
    && award.sourcePeriodStart === periodStart
    && award.status !== "rejected"
  ));
  if (duplicate) return false;
  const prior = completions.filter((event) => event.studentId === studentId && event.questId === quest.id);
  if (!quest.isRepeatable && prior.length > 0) return false;
  if ((quest.cooldownDays ?? 0) > 0 && prior.length > 0) {
    const periodStartMs = new Date(periodStart).getTime();
    const latestUnlockMs = Math.max(...prior.map((event) => {
      const periodEndMs = new Date(event.sourcePeriodEnd).getTime();
      if (Number.isFinite(periodEndMs)) return periodEndMs;
      return new Date(event.completedAt).getTime() + (quest.cooldownDays ?? 0) * 86_400_000;
    }));
    if (!Number.isFinite(periodStartMs) || periodStartMs < latestUnlockMs) return false;
  }
  return true;
}
