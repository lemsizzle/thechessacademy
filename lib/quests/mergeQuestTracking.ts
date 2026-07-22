import type { LichessQuestProgress, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";
import { questProgressIdentity } from "@/lib/quests/questProgressIdentity";

export function mergeQuestAttempts(...groups: Array<StudentQuestAttempt[] | undefined>) {
  const byId = new Map<string, StudentQuestAttempt>();
  for (const group of groups) {
    for (const attempt of group ?? []) {
      const previous = byId.get(attempt.id);
      if (!previous || attempt.status === "completed") {
        byId.set(attempt.id, attempt);
        continue;
      }
      if (previous.status === "completed") continue;

      // The server can repair an attempt window after a quest definition is
      // corrected. Keep the later expiry so an older browser copy cannot
      // shorten the authoritative countdown again.
      byId.set(
        attempt.id,
        new Date(attempt.expiresAt).getTime() > new Date(previous.expiresAt).getTime()
          ? attempt
          : previous
      );
    }
  }
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function mergeLichessQuestProgress(...groups: Array<LichessQuestProgress[] | undefined>) {
  const byKey = new Map<string, LichessQuestProgress>();
  for (const group of groups) {
    for (const item of group ?? []) {
      const key = questProgressIdentity(item);
      const previous = byKey.get(key);
      if (!previous || previous.updatedAt <= item.updatedAt || item.currentValue > previous.currentValue) {
        byKey.set(key, {
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
