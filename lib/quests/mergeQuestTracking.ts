import type { LichessQuestProgress, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";

function progressKey(item: LichessQuestProgress) {
  return `${item.studentId}:${item.questId}:${item.sourcePeriodStart}:${item.sourcePeriodEnd}`;
}

export function mergeQuestAttempts(...groups: Array<StudentQuestAttempt[] | undefined>) {
  const byId = new Map<string, StudentQuestAttempt>();
  for (const group of groups) {
    for (const attempt of group ?? []) {
      const previous = byId.get(attempt.id);
      byId.set(attempt.id, previous?.status === "completed" ? previous : attempt);
    }
  }
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function mergeLichessQuestProgress(...groups: Array<LichessQuestProgress[] | undefined>) {
  const byKey = new Map<string, LichessQuestProgress>();
  for (const group of groups) {
    for (const item of group ?? []) {
      const previous = byKey.get(progressKey(item));
      if (!previous || previous.updatedAt <= item.updatedAt || item.currentValue > previous.currentValue) {
        byKey.set(progressKey(item), {
          ...item,
          currentValue: Math.max(previous?.currentValue ?? 0, item.currentValue),
          completed: Boolean(previous?.completed || item.completed)
        });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function mergeQuestCompletions(...groups: Array<QuestCompletionEvent[] | undefined>) {
  const byId = new Map<string, QuestCompletionEvent>();
  for (const group of groups) {
    for (const item of group ?? []) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}
