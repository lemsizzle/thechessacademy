import type { LichessQuestProgress, Quest } from "@/lib/types";

function progressKey(progress: LichessQuestProgress) {
  return `${progress.studentId}:${progress.questId}:${progress.sourcePeriodStart}:${progress.sourcePeriodEnd}`;
}

function hasFreshSyncError(progress: LichessQuestProgress) {
  return progress.evidence.includes("sync did not return fresh data");
}

function shouldKeepHighWaterMark(quest?: Quest) {
  return quest?.conditionType !== "puzzle_accuracy_threshold" && quest?.conditionType !== "rating_peak";
}

function mergeOneProgress(previous: LichessQuestProgress | undefined, next: LichessQuestProgress, quest?: Quest) {
  if (!previous) return next;
  if (hasFreshSyncError(next)) return previous;
  if (!shouldKeepHighWaterMark(quest) || previous.currentValue <= next.currentValue) return next;

  return {
    ...next,
    currentValue: previous.currentValue,
    completed: previous.completed || next.completed,
    evidence: `${next.evidence} Kept previous high of ${previous.currentValue} for this challenge period.`
  };
}

export function mergeQuestProgress(existing: LichessQuestProgress[], incoming: LichessQuestProgress[], quests: Quest[]) {
  const existingByKey = new Map(existing.map((progress) => [progressKey(progress), progress]));
  const questById = new Map(quests.map((quest) => [quest.id, quest]));
  const incomingKeys = new Set(incoming.map(progressKey));
  const mergedIncoming = incoming.map((next) => mergeOneProgress(existingByKey.get(progressKey(next)), next, questById.get(next.questId)));

  return [
    ...mergedIncoming,
    ...existing.filter((progress) => !incomingKeys.has(progressKey(progress)))
  ];
}
