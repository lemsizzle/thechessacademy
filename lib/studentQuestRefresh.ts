"use client";

import { badges as seedBadges } from "@/data/badges";
import { quests as seedQuests } from "@/data/quests";
import { students as seedStudents } from "@/data/students";
import { getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { mergeQuestProgress } from "@/lib/quests/mergeQuestProgress";
import { isInternalQuestSource } from "@/lib/quests/questOptions";
import { DEFAULT_QUEST_TIMEZONE } from "@/lib/quests/timeWindows";
import type { LichessActivitySnapshot, LichessQuestProgress, PendingQuestAward, QuestCompletionEvent, StudentLichessAccount, StudentUser } from "@/lib/types";

type QuestEvaluationResponse = {
  progress?: LichessQuestProgress[];
  newAwards?: PendingQuestAward[];
  autoApprovedAwards?: PendingQuestAward[];
  autoCompletions?: QuestCompletionEvent[];
  snapshots?: LichessActivitySnapshot[];
  xpEvents?: Array<{ id: string; studentId: string; amount: number; reason: string; createdAt: string }>;
  xpPersisted?: boolean;
  xpError?: string;
  account?: StudentLichessAccount;
  lichessCoinsAwarded?: number;
  coinError?: string;
  error?: string;
  message?: string;
};

export type StudentQuestRefreshResult = {
  user: StudentUser;
  account?: StudentLichessAccount;
  progressCount: number;
  autoCompletedCount: number;
  approvalCount: number;
  badgeAwardCount: number;
  message: string;
};

export const STUDENT_QUEST_REFRESH_EVENT = "quest-board-quest-refresh-complete";
let activeFullSync: Promise<StudentQuestRefreshResult> | null = null;

async function getFreshStudentUser() {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const data = await response.json() as { user?: StudentUser };
    if (response.ok && data.user) {
      setCurrentStudentUserRecord(data.user);
      return data.user;
    }
  } catch {
    // Local mock users still work when there is no server session.
  }
  return getCurrentStudentUser();
}

async function runStudentQuestRefresh(): Promise<StudentQuestRefreshResult> {
  const user = await getFreshStudentUser();
  if (!user) throw new Error("Student log in is required.");

  const store = readAdminStore();
  const badgeAwardCount: number = Number(0);
  const account: StudentLichessAccount | undefined = undefined;
  const rules = (store.quests ?? seedQuests).filter((quest) => quest.isActive !== false && isInternalQuestSource(quest.source));
  const response = await fetch(`/api/quests/evaluate/student/${encodeURIComponent(user.studentId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "",
      quests: rules,
      account,
      arenaResults: (store.arenaTournamentResults ?? []).filter((result) => result.studentId === user.studentId),
      existingAwards: store.pendingQuestAwards ?? [],
      completionEvents: store.questCompletionEvents ?? [],
      questAttempts: (store.studentQuestAttempts ?? []).filter((attempt) => attempt.studentId === user.studentId),
      timeZone: DEFAULT_QUEST_TIMEZONE
    })
  });
  const data = await response.json() as QuestEvaluationResponse & { progressError?: string };
  if (!response.ok || !data.progress || !data.newAwards) throw new Error(data.error ?? "Could not refresh quest progress.");
  const syncNotice = data.message;

  const autoApprovedAwards = data.autoApprovedAwards ?? [];
  const autoCompletions = data.autoCompletions ?? [];
  const badges = store.badges ?? seedBadges;
  const today = new Date().toISOString().slice(0, 10);
  const nextStudents = (store.students ?? seedStudents).map((student) => {
    if (student.id !== user.studentId || !autoApprovedAwards.length) return student;
    return autoApprovedAwards.reduce((next, award) => ({
      ...next,
      totalXp: next.totalXp + award.xpAmount,
      badgeIds: award.badgeId && badges.some((badge) => badge.id === award.badgeId) ? Array.from(new Set([...next.badgeIds, award.badgeId])) : next.badgeIds,
      completedQuestIds: Array.from(new Set([...(next.completedQuestIds ?? []), award.questId]))
    }), student);
  });

  const mergedQuestProgress = mergeQuestProgress(store.lichessQuestProgress ?? [], data.progress, rules);
  const nextQuestAttempts = (store.studentQuestAttempts ?? []).map((attempt) => (
    autoCompletions.some((completion) => (
      completion.studentId === attempt.studentId
      && completion.questId === attempt.questId
      && completion.sourcePeriodEnd === attempt.expiresAt
    ))
      ? { ...attempt, status: "completed" as const }
      : attempt
  ));

  updateAdminStore({
    lichessQuestProgress: mergedQuestProgress,
    pendingQuestAwards: [...data.newAwards, ...(store.pendingQuestAwards ?? [])],
    questCompletionEvents: [...autoCompletions, ...(store.questCompletionEvents ?? [])],
    studentQuestAttempts: nextQuestAttempts,
    questXpEvents: [...(data.xpEvents?.length ? data.xpEvents : autoApprovedAwards.map((award) => ({ id: `xp-${award.id}`, studentId: award.studentId, amount: award.xpAmount, reason: award.title, createdAt: today }))), ...(store.questXpEvents ?? [])],
    questActivityEvents: [...autoApprovedAwards.map((award) => ({ id: `activity-${award.id}`, title: "Quest auto-completed", detail: `${award.title} awarded ${award.xpAmount} XP.`, createdAt: today })), ...(store.questActivityEvents ?? [])],
    students: nextStudents
  });
  void fetch("/api/quest-progress", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      progress: data.progress,
      completions: autoCompletions,
      attempts: nextQuestAttempts.filter((attempt) => attempt.studentId === user.studentId)
    })
  });

  const result = {
    user,
    account,
    progressCount: data.progress.length,
    autoCompletedCount: autoCompletions.length,
    approvalCount: data.newAwards.length,
    badgeAwardCount,
    message: [
      `${data.progress.length} automated quests checked.`,
      syncNotice ?? "",
      `${autoCompletions.length} auto-completed${autoCompletions.length > 0 ? (data.xpError ? ", but XP could not be saved to Supabase" : " with XP") : ""}.`,
      data.progressError ? "Quest progress could not be saved to Supabase." : "",
      data.coinError ? "Academy Coins could not be updated." : "",
      `${badgeAwardCount} badge award${badgeAwardCount === 1 ? "" : "s"} found.`
    ].filter(Boolean).join(" ")
  };

  window.dispatchEvent(new CustomEvent(STUDENT_QUEST_REFRESH_EVENT, { detail: result }));
  return result;
}

export async function refreshStudentQuests(): Promise<StudentQuestRefreshResult> {
  if (activeFullSync) return activeFullSync;
  activeFullSync = runStudentQuestRefresh().finally(() => {
    activeFullSync = null;
  });
  return activeFullSync;
}
