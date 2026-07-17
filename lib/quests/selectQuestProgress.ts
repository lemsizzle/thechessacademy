import type { LichessQuestProgress, PendingQuestAward, Quest, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";

export function newestByDate<T>(items: T[], getDate: (item: T) => string) {
  return [...items].sort((a, b) => getDate(b).localeCompare(getDate(a)))[0];
}

function timeMs(value?: string) {
  if (!value) return Number.NaN;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function isCloseTime(left?: string, right?: string) {
  const leftMs = timeMs(left);
  const rightMs = timeMs(right);
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && Math.abs(leftMs - rightMs) < 60_000;
}

const QUEST_PERIOD_MATCH_TOLERANCE_MS = 60_000;

function periodIsInsideAttempt(
  left?: { sourcePeriodStart: string; sourcePeriodEnd: string },
  right?: { startedAt: string; expiresAt: string }
) {
  if (!left || !right) return false;
  const leftStart = timeMs(left.sourcePeriodStart);
  const leftEnd = timeMs(left.sourcePeriodEnd);
  const rightStart = timeMs(right.startedAt);
  const rightEnd = timeMs(right.expiresAt);
  if (![leftStart, leftEnd, rightStart, rightEnd].every(Number.isFinite)) return false;
  return (
    leftStart >= rightStart - QUEST_PERIOD_MATCH_TOLERANCE_MS
    && leftStart <= rightEnd + QUEST_PERIOD_MATCH_TOLERANCE_MS
    && leftEnd <= rightEnd + QUEST_PERIOD_MATCH_TOLERANCE_MS
  );
}

export function periodMatchesAttempt(period: { sourcePeriodStart: string; sourcePeriodEnd: string }, attempt: StudentQuestAttempt) {
  return (
    (period.sourcePeriodStart === attempt.startedAt && period.sourcePeriodEnd === attempt.expiresAt)
    || (isCloseTime(period.sourcePeriodStart, attempt.startedAt) && isCloseTime(period.sourcePeriodEnd, attempt.expiresAt))
    || periodIsInsideAttempt(period, attempt)
  );
}

export function shouldUseHighestProgress(quest: Quest) {
  return quest.conditionType !== "puzzle_accuracy_threshold" && quest.conditionType !== "rating_peak";
}

function bestProgressForQuest(items: LichessQuestProgress[], quest: Quest) {
  if (!items.length) return undefined;
  if (!shouldUseHighestProgress(quest)) return newestByDate(items, (item) => item.updatedAt);

  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? -1 : 1;
    if (a.currentValue !== b.currentValue) return b.currentValue - a.currentValue;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0];
}

export function findAttemptForPeriod(attempts: StudentQuestAttempt[], period?: { sourcePeriodStart: string; sourcePeriodEnd: string }) {
  if (!period) return undefined;
  return attempts.find((attempt) => periodMatchesAttempt(period, attempt));
}

export function selectQuestProgress({
  quest,
  progress,
  completion,
  attempt
}: {
  quest: Quest;
  progress: LichessQuestProgress[];
  completion?: QuestCompletionEvent;
  attempt?: StudentQuestAttempt;
}) {
  const allQuestProgress = progress.filter((item) => item.questId === quest.id);
  const questProgress = attempt
    ? allQuestProgress.filter((item) => periodMatchesAttempt(item, attempt))
    : allQuestProgress;

  if (completion) {
    const matchingPeriod = questProgress.find((item) => (
      item.sourcePeriodStart === completion.sourcePeriodStart && item.sourcePeriodEnd === completion.sourcePeriodEnd
    ));
    if (matchingPeriod) return matchingPeriod;
    const completedProgress = bestProgressForQuest(questProgress.filter((item) => item.completed), quest);
    if (completedProgress) return completedProgress;
  }

  const matchedProgress = bestProgressForQuest(questProgress, quest);
  if (matchedProgress && (matchedProgress.currentValue > 0 || !shouldUseHighestProgress(quest))) return matchedProgress;

  if (attempt) return matchedProgress;

  const meaningfulProgress = allQuestProgress.filter((item) => item.currentValue > 0 || item.completed);

  return bestProgressForQuest(meaningfulProgress, quest) ?? matchedProgress ?? bestProgressForQuest(allQuestProgress, quest);
}

export function selectQuestCompletion({
  quest,
  completions,
  attempt
}: {
  quest: Quest;
  completions: QuestCompletionEvent[];
  attempt?: StudentQuestAttempt;
}) {
  const questCompletions = completions.filter((item) => item.questId === quest.id);
  return newestByDate(
    attempt ? questCompletions.filter((item) => periodMatchesAttempt(item, attempt)) : questCompletions,
    (item) => item.completedAt
  );
}

export function selectPendingQuestAward({
  quest,
  awards,
  attempt
}: {
  quest: Quest;
  awards: PendingQuestAward[];
  attempt?: StudentQuestAttempt;
}) {
  const questAwards = awards.filter((item) => item.questId === quest.id && item.status === "pending");
  return newestByDate(
    attempt ? questAwards.filter((item) => periodMatchesAttempt(item, attempt)) : questAwards,
    (item) => item.createdAt
  );
}
