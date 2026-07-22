import type { LichessQuestProgress, Quest } from "@/lib/types";
import { questProgressIdentity } from "@/lib/quests/questProgressIdentity";

function hasFreshSyncError(progress: LichessQuestProgress) {
  return /sync did not return fresh data|sync paused|rate-limited|rate limit reached|requires the student's Lichess login token/i.test(progress.evidence);
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
  const existingByKey = new Map(existing.map((progress) => [questProgressIdentity(progress), progress]));
  const questById = new Map(quests.map((quest) => [quest.id, quest]));
  const incomingKeys = new Set(incoming.map(questProgressIdentity));
  const mergedIncoming = incoming.map((next) => mergeOneProgress(existingByKey.get(questProgressIdentity(next)), next, questById.get(next.questId)));

  return [
    ...mergedIncoming,
    ...existing.filter((progress) => !incomingKeys.has(questProgressIdentity(progress)))
  ];
}
