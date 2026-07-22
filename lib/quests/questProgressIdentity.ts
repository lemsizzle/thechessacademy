import type { LichessQuestProgress } from "@/lib/types";

function canonicalTimestamp(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : value;
}

export function questProgressIdentity(progress: Pick<LichessQuestProgress, "studentId" | "questId" | "sourcePeriodStart" | "sourcePeriodEnd">) {
  return [
    progress.studentId,
    progress.questId,
    canonicalTimestamp(progress.sourcePeriodStart),
    canonicalTimestamp(progress.sourcePeriodEnd)
  ].join(":");
}
