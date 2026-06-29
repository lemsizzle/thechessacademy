import type { Quest, QuestTimeWindow, StudentQuestAttempt } from "@/lib/types";
import type { QuestWindow } from "@/lib/quests/timeWindows";

export function getQuestDurationMs(timeWindow: QuestTimeWindow = "weekly") {
  if (timeWindow === "daily") return 24 * 60 * 60 * 1000;
  if (timeWindow === "weekly") return 7 * 24 * 60 * 60 * 1000;
  if (timeWindow === "monthly") return 30 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export function createStudentQuestAttempt(studentId: string, quest: Quest, now = new Date()): StudentQuestAttempt {
  const expiresAt = new Date(now.getTime() + getQuestDurationMs(quest.timeWindow));
  return {
    id: `quest-attempt-${studentId}-${quest.id}-${now.getTime()}`,
    studentId,
    questId: quest.id,
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "active",
    createdAt: now.toISOString()
  };
}

export function isQuestAttemptActive(attempt: StudentQuestAttempt | undefined, now = new Date()) {
  return Boolean(attempt && attempt.status === "active" && new Date(attempt.expiresAt).getTime() > now.getTime());
}

export function getActiveQuestAttempt(attempts: StudentQuestAttempt[], studentId: string, questId: string, now = new Date()) {
  return attempts
    .filter((attempt) => attempt.studentId === studentId && attempt.questId === questId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .find((attempt) => isQuestAttemptActive(attempt, now));
}

export function getAttemptQuestWindow(attempt: StudentQuestAttempt): QuestWindow {
  const start = new Date(attempt.startedAt);
  const end = new Date(attempt.expiresAt);
  return {
    start,
    end,
    label: `${start.toISOString().slice(0, 10)} ${start.toISOString().slice(11, 16)} to ${end.toISOString().slice(0, 10)} ${end.toISOString().slice(11, 16)}`
  };
}

export function formatCountdown(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
