"use client";

import { badges as seedBadges } from "@/data/badges";
import { lichessConnections as seedConnections, lichessSyncLogs as seedLogs, pendingAwards as seedPendingAwards, studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { quests as seedQuests } from "@/data/quests";
import { students as seedStudents } from "@/data/students";
import { studentTacticProgress as seedProgress } from "@/data/studentTacticProgress";
import { getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { createPendingAwardsFromProgress, mergeTacticProgress } from "@/lib/lichess";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { DEFAULT_QUEST_TIMEZONE } from "@/lib/quests/timeWindows";
import { mergeQuestProgress } from "@/lib/quests/mergeQuestProgress";
import { saveStudentLichessAccount } from "@/lib/studentLichessAccountStore";
import type { LichessActivitySnapshot, LichessConnection, LichessQuestProgress, LichessSyncLog, PendingQuestAward, QuestCompletionEvent, StudentLichessAccount, TacticTheme, StudentUser } from "@/lib/types";

type QuestEvaluationResponse = {
  progress?: LichessQuestProgress[];
  newAwards?: PendingQuestAward[];
  autoApprovedAwards?: PendingQuestAward[];
  autoCompletions?: QuestCompletionEvent[];
  snapshots?: LichessActivitySnapshot[];
  xpEvents?: Array<{ id: string; studentId: string; amount: number; reason: string; createdAt: string }>;
  xpPersisted?: boolean;
  xpError?: string;
  error?: string;
};

export type StudentLichessFullSyncResult = {
  user: StudentUser;
  account?: StudentLichessAccount;
  progressCount: number;
  autoCompletedCount: number;
  approvalCount: number;
  badgeAwardCount: number;
  message: string;
};

export const STUDENT_LICHESS_FULL_SYNC_EVENT = "quest-board-lichess-full-sync-complete";

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

export async function syncStudentLichessEverything(): Promise<StudentLichessFullSyncResult> {
  const user = await getFreshStudentUser();
  if (!user) throw new Error("Student log in is required.");

  let store = readAdminStore();
  let account: StudentLichessAccount | undefined;

  try {
    const previousAccount = (store.studentLichessAccounts ?? seedAccounts).find((item) => item.studentId === user.studentId);
    const syncResponse = await fetch("/api/lichess/sync/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previousAccount })
    });
    const syncData = await syncResponse.json() as { account?: StudentLichessAccount; message?: string };
    if (syncResponse.ok && syncData.account) {
      account = saveStudentLichessAccount(syncData.account);
      store = readAdminStore();
    }
  } catch {
    // Quest checks can still use the saved username or session username.
  }

  account = account ?? (store.studentLichessAccounts ?? seedAccounts).find((item) => item.studentId === user.studentId);
  const username = account?.lichessUsername ?? user.lichessUsername;
  if (!username) throw new Error("No linked Lichess username was found. Log out and log back in with Lichess, then sync again.");

  let badgeAwardCount = 0;
  try {
    const puzzleResponse = await fetch("/api/lichess/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, studentId: user.studentId })
    });
    const puzzleData = await puzzleResponse.json() as {
      mode?: "mock" | "connected";
      counts?: Array<{ tacticTheme: TacticTheme; puzzlesSolved: number }>;
      ratings?: StudentLichessAccount;
      message?: string;
    };
    if (puzzleResponse.ok) {
      store = readAdminStore();
      const students = store.students ?? seedStudents;
      const currentStudent = students.find((student) => student.id === user.studentId);
      const existingProgress = store.studentTacticProgress ?? seedProgress;
      const existingAwards = store.pendingAwards ?? seedPendingAwards;
      const counts = new Map((puzzleData.counts ?? []).map((item) => [item.tacticTheme, item.puzzlesSolved] as const));
      const mergedProgress = mergeTacticProgress(existingProgress, user.studentId, counts);
      const newBadgeAwards = currentStudent ? createPendingAwardsFromProgress(currentStudent, mergedProgress, existingAwards) : [];
      badgeAwardCount = newBadgeAwards.length;
      const today = new Date().toISOString().slice(0, 10);
      const nextConnection: LichessConnection = {
        studentId: user.studentId,
        lichessUsername: username,
        connectedAt: store.lichessConnections?.find((item) => item.studentId === user.studentId)?.connectedAt ?? today,
        lastSyncedAt: today,
        status: puzzleData.mode ?? "mock"
      };
      const syncLog: LichessSyncLog = {
        id: `lichess-log-${Date.now()}`,
        studentId: user.studentId,
        level: puzzleData.mode === "mock" ? "warning" : "info",
        message: `${puzzleData.message ?? "Lichess sync complete"} ${newBadgeAwards.length} pending badge award${newBadgeAwards.length === 1 ? "" : "s"} sent to teacher.`,
        createdAt: today
      };
      updateAdminStore({
        studentTacticProgress: mergedProgress,
        pendingAwards: [...newBadgeAwards, ...existingAwards],
        lichessConnections: [
          nextConnection,
          ...(store.lichessConnections ?? seedConnections).filter((item) => item.studentId !== user.studentId)
        ],
        lichessSyncLogs: [syncLog, ...(store.lichessSyncLogs ?? seedLogs)].slice(0, 20)
      });
      if (puzzleData.ratings) account = saveStudentLichessAccount({ ...puzzleData.ratings, studentId: user.studentId });
      store = readAdminStore();
    }
  } catch {
    // Quest sync still runs even if puzzle badge progress could not be refreshed.
  }

  const rules = (store.quests ?? seedQuests).filter((quest) => quest.isActive !== false && quest.source?.startsWith("lichess_"));
  const response = await fetch(`/api/lichess/quests/evaluate/student/${encodeURIComponent(user.studentId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      quests: rules,
      account,
      arenaResults: (store.arenaTournamentResults ?? []).filter((result) => result.studentId === user.studentId),
      existingAwards: store.pendingQuestAwards ?? [],
      completionEvents: store.questCompletionEvents ?? [],
      questAttempts: (store.studentQuestAttempts ?? []).filter((attempt) => attempt.studentId === user.studentId),
      timeZone: DEFAULT_QUEST_TIMEZONE
    })
  });
  const data = await response.json() as QuestEvaluationResponse;
  if (!response.ok || !data.progress || !data.newAwards) throw new Error(data.error ?? "Could not sync Lichess progress.");

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
    questActivityEvents: [...autoApprovedAwards.map((award) => ({ id: `activity-${award.id}`, title: "Lichess quest auto-completed", detail: `${award.title} awarded ${award.xpAmount} XP.`, createdAt: today })), ...(store.questActivityEvents ?? [])],
    students: nextStudents,
    lichessActivitySnapshots: [...(data.snapshots ?? []), ...(store.lichessActivitySnapshots ?? [])]
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
    message: `${data.progress.length} Lichess quests checked. ${autoCompletions.length} auto-completed${data.xpError ? ", but XP could not be saved to Supabase" : " with XP"}. ${badgeAwardCount} badge award${badgeAwardCount === 1 ? "" : "s"} found.`
  };

  window.dispatchEvent(new CustomEvent(STUDENT_LICHESS_FULL_SYNC_EVENT, { detail: result }));
  return result;
}
