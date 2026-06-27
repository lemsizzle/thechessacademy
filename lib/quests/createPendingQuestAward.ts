import { canCreateQuestAward, questAwardId } from "@/lib/quests/questDuplicatePrevention";
import type { LichessQuestProgress, PendingQuestAward, Quest, QuestCompletionEvent } from "@/lib/types";

const QUEST_XP_CAPS = {
  daily: 300,
  weekly: 600,
  monthly: 1200,
  tournament: 300,
  all_time: 500,
  custom: 500
} as const;

export function createPendingQuestAwards(
  studentId: string,
  quests: Quest[],
  progress: LichessQuestProgress[],
  pending: PendingQuestAward[],
  completions: QuestCompletionEvent[]
) {
  const usedXpByPeriod = new Map<string, number>();
  const awards: PendingQuestAward[] = [];

  for (const item of progress) {
    const quest = quests.find((candidate) => candidate.id === item.questId);
    if (!quest || !item.completed || !quest.source || !canCreateQuestAward(studentId, quest, item.sourcePeriodStart, [...pending, ...awards], completions)) continue;

    const periodKey = `${studentId}-${item.sourcePeriodStart}`;
    const alreadyReservedXp = usedXpByPeriod.get(periodKey) ?? 0;
    const periodPendingXp = pending
      .filter((award) => award.studentId === studentId && award.sourcePeriodStart === item.sourcePeriodStart && award.status === "pending")
      .reduce((total, award) => total + award.xpAmount, 0);
    const periodCompletedXp = completions
      .filter((event) => event.studentId === studentId && event.sourcePeriodStart === item.sourcePeriodStart)
      .reduce((total, event) => total + event.xpAwarded, 0);
    const cap = QUEST_XP_CAPS[quest.timeWindow ?? "weekly"];
    const xpAmount = Math.min(quest.xpReward, Math.max(0, cap - periodPendingXp - periodCompletedXp - alreadyReservedXp));
    if (xpAmount <= 0) continue;

    awards.push({
      id: questAwardId(studentId, quest.id, item.sourcePeriodStart),
      studentId,
      questId: quest.id,
      source: quest.source,
      sourcePeriodStart: item.sourcePeriodStart,
      sourcePeriodEnd: item.sourcePeriodEnd,
      title: quest.title,
      description: quest.description,
      xpAmount,
      badgeId: quest.badgeRewardId,
      evidence: `${item.evidence}${item.mode === "mock" ? " Mock fallback evaluation." : ""}`,
      status: "pending",
      createdAt: new Date().toISOString()
    });
    usedXpByPeriod.set(periodKey, alreadyReservedXp + xpAmount);
  }

  return awards;
}
