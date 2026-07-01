import { getLichessXpBreakdown } from "@/lib/lichessXp";
import type { Badge, Quest, QuestCompletionEvent, Student, StudentLichessAccount, XpEvent } from "@/lib/types";

export type StudentActivityKind = "xp" | "game" | "puzzle" | "quest" | "badge";

export type StudentActivityItem = {
  id: string;
  kind: StudentActivityKind;
  title: string;
  detail: string;
  createdAt?: string;
  amount?: number;
};

function formatSignedXp(amount: number) {
  return `${amount >= 0 ? "+" : ""}${amount.toLocaleString()} XP`;
}

function normalizeDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function isQuestXpEvent(event: XpEvent) {
  return event.reason.toLowerCase().startsWith("quest completed:");
}

export function buildStudentActivityItems({
  student,
  badges,
  quests,
  xpEvents,
  questCompletions,
  lichessAccount,
  limit = 12
}: {
  student: Student;
  badges: Badge[];
  quests?: Quest[];
  xpEvents?: XpEvent[];
  questCompletions?: QuestCompletionEvent[];
  lichessAccount?: StudentLichessAccount;
  limit?: number;
}) {
  const items: StudentActivityItem[] = [];
  const completedQuestKeys = new Set<string>();

  for (const completion of questCompletions?.filter((item) => item.studentId === student.id) ?? []) {
    const quest = quests?.find((item) => item.id === completion.questId);
    completedQuestKeys.add(`${completion.questId}:${completion.sourcePeriodStart}`);
    items.push({
      id: `quest-${completion.id}`,
      kind: "quest",
      title: "Quest completed",
      detail: `${quest?.title ?? completion.questId} awarded ${completion.xpAwarded.toLocaleString()} XP.`,
      createdAt: normalizeDate(completion.completedAt),
      amount: completion.xpAwarded
    });
  }

  for (const event of xpEvents?.filter((item) => item.studentId === student.id) ?? []) {
    const questEventAlreadyShown = isQuestXpEvent(event)
      && Array.from(completedQuestKeys).some((key) => event.reason.includes(key.split(":")[0]) || event.reason.includes(key.split(":")[1]?.slice(0, 10) ?? ""));
    if (questEventAlreadyShown) continue;
    items.push({
      id: `xp-${event.id}`,
      kind: "xp",
      title: event.amount >= 0 ? "XP gained" : "XP adjusted",
      detail: `${formatSignedXp(event.amount)} - ${event.reason}`,
      createdAt: normalizeDate(event.createdAt),
      amount: event.amount
    });
  }

  if (lichessAccount) {
    const xp = getLichessXpBreakdown(lichessAccount);
    if (xp.rapidGamesAfterLogin > 0) {
      items.push({
        id: `lichess-rapid-${student.id}`,
        kind: "game",
        title: "Rapid games counted",
        detail: `${xp.rapidGamesAfterLogin} rated rapid game${xp.rapidGamesAfterLogin === 1 ? "" : "s"} played, ${xp.rapidWinsAfterLogin} won, ${xp.rapidGameXp + xp.rapidWinXp} XP.`,
        createdAt: normalizeDate(lichessAccount.lastGameSyncAt ?? lichessAccount.updatedAt),
        amount: xp.rapidGameXp + xp.rapidWinXp
      });
    }
    if (xp.blitzGamesAfterLogin > 0) {
      items.push({
        id: `lichess-blitz-${student.id}`,
        kind: "game",
        title: "Blitz games counted",
        detail: `${xp.blitzGamesAfterLogin} rated blitz game${xp.blitzGamesAfterLogin === 1 ? "" : "s"} played, ${xp.blitzWinsAfterLogin} won, ${xp.blitzGameXp + xp.blitzWinXp} XP.`,
        createdAt: normalizeDate(lichessAccount.lastGameSyncAt ?? lichessAccount.updatedAt),
        amount: xp.blitzGameXp + xp.blitzWinXp
      });
    }
    if (xp.puzzleCorrectAfterLogin > 0) {
      items.push({
        id: `lichess-puzzles-${student.id}`,
        kind: "puzzle",
        title: "Puzzles solved",
        detail: `${xp.puzzleCorrectAfterLogin} correct Lichess puzzle${xp.puzzleCorrectAfterLogin === 1 ? "" : "s"} counted, ${xp.puzzleActivityXp} XP.`,
        createdAt: normalizeDate(lichessAccount.lastPuzzleSyncAt ?? lichessAccount.updatedAt),
        amount: xp.puzzleActivityXp
      });
    }
  }

  for (const badgeId of student.badgeIds) {
    const badge = badges.find((item) => item.id === badgeId);
    items.push({
      id: `badge-${student.id}-${badgeId}`,
      kind: "badge",
      title: "Badge acquired",
      detail: badge ? `${badge.name} - ${badge.description}` : badgeId,
      createdAt: normalizeDate(badge?.createdAt),
      amount: badge?.xpValue
    });
  }

  return items
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, limit);
}
