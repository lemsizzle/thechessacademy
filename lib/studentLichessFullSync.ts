"use client";

import { badges as seedBadges } from "@/data/badges";
import { lichessConnections as seedConnections, lichessSyncLogs as seedLogs, studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { quests as seedQuests } from "@/data/quests";
import { students as seedStudents } from "@/data/students";
import { getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { DEFAULT_QUEST_TIMEZONE } from "@/lib/quests/timeWindows";
import { mergeQuestProgress } from "@/lib/quests/mergeQuestProgress";
import { saveStudentLichessAccount } from "@/lib/studentLichessAccountStore";
import type { LichessActivitySnapshot, LichessConnection, LichessQuestProgress, LichessSyncLog, PendingQuestAward, QuestCompletionEvent, StudentLichessAccount, StudentUser } from "@/lib/types";

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
  message?: string;
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
let activeFullSync: Promise<StudentLichessFullSyncResult> | null = null;

function activityCountFromAccount(account: StudentLichessAccount | undefined, total: number | undefined, baseline: number | undefined) {
  if (!account || total === undefined) return 0;
  return Math.max(0, total - (baseline ?? total));
}

function reconcileAccountWithQuestProgress(account: StudentLichessAccount | undefined, progress: LichessQuestProgress[], rules: typeof seedQuests): StudentLichessAccount | undefined {
  if (!account) return account;

  const questById = new Map(rules.map((quest) => [quest.id, quest]));
  let minimumRapidPlayed = activityCountFromAccount(account, account.rapidGames, account.baselineRapidGames);
  let minimumRapidWon = account.rapidWins ?? 0;
  let minimumBlitzPlayed = activityCountFromAccount(account, account.blitzGames, account.baselineBlitzGames);
  let minimumBlitzWon = account.blitzWins ?? 0;
  let minimumPuzzleCorrect = account.puzzleCorrect ?? 0;
  let minimumPuzzleAttempts = activityCountFromAccount(account, account.puzzleGames, account.baselinePuzzleGames);

  for (const item of progress.filter((entry) => entry.studentId === account.studentId && entry.currentValue > 0 && entry.mode === "connected")) {
    const quest = questById.get(item.questId);
    if (!quest) continue;

    if (quest.conditionType === "rapid_games_played_count" || quest.conditionType === "rated_games_played_count") {
      minimumRapidPlayed = Math.max(minimumRapidPlayed, item.currentValue);
    }
    if (quest.conditionType === "rapid_win_count" || quest.conditionType === "rated_win_count") {
      minimumRapidWon = Math.max(minimumRapidWon, item.currentValue);
    }
    if (quest.conditionType === "blitz_games_played_count") {
      minimumBlitzPlayed = Math.max(minimumBlitzPlayed, item.currentValue);
    }
    if (quest.conditionType === "blitz_win_count") {
      minimumBlitzWon = Math.max(minimumBlitzWon, item.currentValue);
    }
    if (quest.conditionType === "puzzle_solved_count" || quest.conditionType === "puzzle_theme_solved_count") {
      minimumPuzzleCorrect = Math.max(minimumPuzzleCorrect, item.currentValue);
      minimumPuzzleAttempts = Math.max(minimumPuzzleAttempts, item.currentValue);
    }
    if (quest.conditionType === "puzzle_accuracy_threshold") {
      const solved = Math.round(item.currentValue * ((item.accuracy ?? 0) / 100));
      minimumPuzzleCorrect = Math.max(minimumPuzzleCorrect, solved);
      minimumPuzzleAttempts = Math.max(minimumPuzzleAttempts, item.currentValue);
    }
  }

  return {
    ...account,
    rapidWins: minimumRapidWon,
    blitzWins: minimumBlitzWon,
    puzzleCorrect: minimumPuzzleCorrect,
    baselineRapidGames: Math.max(0, account.rapidGames - minimumRapidPlayed),
    baselineBlitzGames: Math.max(0, account.blitzGames - minimumBlitzPlayed),
    baselinePuzzleGames: Math.max(0, (account.puzzleGames ?? 0) - minimumPuzzleAttempts),
    updatedAt: new Date().toISOString()
  };
}

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

async function runStudentLichessFullSync(): Promise<StudentLichessFullSyncResult> {
  const user = await getFreshStudentUser();
  if (!user) throw new Error("Student log in is required.");

  let store = readAdminStore();
  let account: StudentLichessAccount | undefined;

  try {
    const previousAccount = (store.studentLichessAccounts ?? seedAccounts).find((item) => item.studentId === user.studentId);
    const syncResponse = await fetch("/api/lichess/sync/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previousAccount, includeActivity: false })
    });
    const syncData = await syncResponse.json() as { account?: StudentLichessAccount; message?: string; error?: string };
    if (!syncResponse.ok) throw new Error(syncData.error ?? "Could not sync Lichess profile.");
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
  const syncDate = new Date().toISOString().slice(0, 10);
  const nextConnection: LichessConnection = {
    studentId: user.studentId,
    lichessUsername: username,
    connectedAt: store.lichessConnections?.find((item) => item.studentId === user.studentId)?.connectedAt ?? syncDate,
    lastSyncedAt: syncDate,
    status: account ? "connected" : "needs-auth"
  };
  const syncLog: LichessSyncLog = {
    id: `lichess-log-${Date.now()}`,
    studentId: user.studentId,
    level: account ? "info" : "warning",
    message: "Lichess profile checked. Quest activity sync is running from one shared flow.",
    createdAt: syncDate
  };
  updateAdminStore({
    lichessConnections: [
      nextConnection,
      ...(store.lichessConnections ?? seedConnections).filter((item) => item.studentId !== user.studentId)
    ],
    lichessSyncLogs: [syncLog, ...(store.lichessSyncLogs ?? seedLogs)].slice(0, 20)
  });
  store = readAdminStore();

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
  const data = await response.json() as QuestEvaluationResponse & { progressError?: string };
  if (!response.ok || !data.progress || !data.newAwards) throw new Error(data.error ?? "Could not sync Lichess progress.");
  if (data.message) {
    throw new Error(data.message);
  }

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
  account = reconcileAccountWithQuestProgress(account, mergedQuestProgress, rules);
  if (account) saveStudentLichessAccount(account);
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
    message: [
      `${data.progress.length} Lichess quests checked.`,
      `${autoCompletions.length} auto-completed${autoCompletions.length > 0 ? (data.xpError ? ", but XP could not be saved to Supabase" : " with XP") : ""}.`,
      data.progressError ? "Quest progress could not be saved to Supabase." : "",
      `${badgeAwardCount} badge award${badgeAwardCount === 1 ? "" : "s"} found.`
    ].filter(Boolean).join(" ")
  };

  window.dispatchEvent(new CustomEvent(STUDENT_LICHESS_FULL_SYNC_EVENT, { detail: result }));
  return result;
}

export async function syncStudentLichessEverything(): Promise<StudentLichessFullSyncResult> {
  if (activeFullSync) return activeFullSync;
  activeFullSync = runStudentLichessFullSync().finally(() => {
    activeFullSync = null;
  });
  return activeFullSync;
}
