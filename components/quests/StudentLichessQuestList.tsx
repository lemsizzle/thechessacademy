"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LichessQuestProgressCard } from "@/components/quests/LichessQuestProgressCard";
import { quests as seedQuests } from "@/data/quests";
import { getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { mergeLichessQuestProgress, mergeQuestAttempts, mergeQuestCompletions } from "@/lib/quests/mergeQuestTracking";
import { createStudentQuestAttempt, getActiveQuestAttempt } from "@/lib/quests/questAttempts";
import { findAttemptForPeriod, newestByDate, selectPendingQuestAward, selectQuestCompletion, selectQuestProgress } from "@/lib/quests/selectQuestProgress";
import { STUDENT_LICHESS_FULL_SYNC_EVENT, syncStudentLichessEverything } from "@/lib/studentLichessFullSync";
import type { LichessQuestProgress, PendingQuestAward, Quest, QuestCompletionEvent, StudentQuestAttempt, StudentUser } from "@/lib/types";
import { useEffect, useState } from "react";

export function StudentLichessQuestList() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progress, setProgress] = useState<LichessQuestProgress[]>([]);
  const [awards, setAwards] = useState<PendingQuestAward[]>([]);
  const [completions, setCompletions] = useState<QuestCompletionEvent[]>([]);
  const [attempts, setAttempts] = useState<StudentQuestAttempt[]>([]);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("Use one Lichess sync to refresh ratings, games, puzzles, quests, and badge checks.");
  const [syncing, setSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<StudentUser | null>(null);

  async function resolveCurrentUser() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
      const data = await response.json() as { user?: StudentUser };
      if (response.ok && data.user) {
        setCurrentStudentUserRecord(data.user);
        setCurrentUser(data.user);
        return data.user;
      }
    } catch {
      // Fall back to the local session mirror when the server session is unavailable locally.
    }

    const localUser = getCurrentStudentUser();
    setCurrentUser(localUser);
    return localUser;
  }

  async function refreshPersistedQuestTracking(studentId?: string) {
    if (!studentId) return;
    try {
      const response = await fetch("/api/quest-progress", { cache: "no-store", credentials: "include" });
      const data = await response.json() as {
        configured?: boolean;
        error?: string;
        attempts?: StudentQuestAttempt[];
        progress?: LichessQuestProgress[];
        completions?: QuestCompletionEvent[];
      };
      if (!response.ok) return;
      if (!data.configured || data.error) return;
      const store = readAdminStore();
      const localAttempts = (store.studentQuestAttempts ?? []).filter((item) => item.studentId === studentId);
      const localProgress = (store.lichessQuestProgress ?? []).filter((item) => item.studentId === studentId);
      const localCompletions = (store.questCompletionEvents ?? []).filter((item) => item.studentId === studentId);
      const mergedAttempts = mergeQuestAttempts(data.attempts, localAttempts);
      const mergedProgress = mergeLichessQuestProgress(data.progress, localProgress);
      const mergedCompletions = mergeQuestCompletions(data.completions, localCompletions);
      const otherAttempts = (store.studentQuestAttempts ?? []).filter((item) => item.studentId !== studentId);
      const otherProgress = (store.lichessQuestProgress ?? []).filter((item) => item.studentId !== studentId);
      const otherCompletions = (store.questCompletionEvents ?? []).filter((item) => item.studentId !== studentId);
      updateAdminStore({
        studentQuestAttempts: [...mergedAttempts, ...otherAttempts],
        lichessQuestProgress: [...mergedProgress, ...otherProgress],
        questCompletionEvents: [...mergedCompletions, ...otherCompletions]
      });
      setAttempts(mergedAttempts);
      setProgress(mergedProgress);
      setCompletions(mergedCompletions);
    } catch {
      // Local quest progress remains available when Supabase tracking is not configured.
    }
  }

  async function refreshServerQuests(visibleQuestIds: Set<string>, localQuests: Quest[]) {
    try {
      const response = await fetch("/api/quests", { cache: "no-store" });
      const data = await response.json() as { data?: Quest[] };
      if (!response.ok || !data.data) return false;

      const localById = new Map(localQuests.map((quest) => [quest.id, quest]));
      const mergedQuests = data.data.map((quest) => {
        const localQuest = localById.get(quest.id);
        return localQuest ? { ...quest, ...localQuest, completionUrl: localQuest.completionUrl ?? quest.completionUrl } : quest;
      });
      const visibleQuests = mergedQuests.filter((quest) => (
        quest.source?.startsWith("lichess_")
        && quest.isActive !== false
        && (quest.isLive || visibleQuestIds.has(quest.id))
      ));
      if (!visibleQuests.length) return false;

      setQuests(visibleQuests);
      return true;
    } catch {
      return false;
    }
  }

  async function load() {
    const user = await resolveCurrentUser();
    const store = readAdminStore();
    const studentId = user?.studentId;
    const studentProgress = (store.lichessQuestProgress ?? []).filter((item) => item.studentId === studentId);
    const studentAwards = (store.pendingQuestAwards ?? []).filter((item) => item.studentId === studentId);
    const studentCompletions = (store.questCompletionEvents ?? []).filter((item) => item.studentId === studentId);
    const studentAttempts = (store.studentQuestAttempts ?? []).filter((item) => item.studentId === studentId);
    const visibleQuestIds = new Set([
      ...studentProgress.filter((item) => item.completed).map((item) => item.questId),
      ...studentAwards.map((item) => item.questId),
      ...studentCompletions.map((item) => item.questId)
    ]);

    const localQuests = store.quests ?? seedQuests;
    const loadedServerQuests = await refreshServerQuests(visibleQuestIds, localQuests);
    if (!loadedServerQuests) {
      setQuests(localQuests.filter((quest) => (
        quest.source?.startsWith("lichess_")
        && quest.isActive !== false
        && (quest.isLive || visibleQuestIds.has(quest.id))
      )));
    }
    setProgress(studentProgress);
    setAwards(studentAwards);
    setCompletions(studentCompletions);
    setAttempts(studentAttempts);
    await refreshPersistedQuestTracking(studentId);
  }

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, refresh);
    return () => window.removeEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, refresh);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function startQuest(quest: Quest) {
    const user = currentUser ?? getCurrentStudentUser();
    if (!user) return;
    const store = readAdminStore();
    const previousAttempts = store.studentQuestAttempts ?? [];
    const attempt = createStudentQuestAttempt(user.studentId, quest);
    const nextAttempts = mergeQuestAttempts([
      attempt,
      ...previousAttempts
    ]);
    updateAdminStore({ studentQuestAttempts: nextAttempts });
    setAttempts(nextAttempts.filter((item) => item.studentId === user.studentId));
    void fetch("/api/quest-progress", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempts: [attempt] })
    });
    setMessage(`${quest.title} started. Your countdown is running.`);
  }
  async function evaluate() {
    setSyncing(true);
    try {
      const result = await syncStudentLichessEverything();
      setMessage(result.message);
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sync Lichess.");
    } finally {
      setSyncing(false);
    }
  }

  const studentId = currentUser?.studentId ?? getCurrentStudentUser()?.studentId ?? "";
  const nowDate = new Date(now);
  const completionIsCurrent = (quest: Quest) => {
    const latestCompletion = newestByDate(completions.filter((item) => item.questId === quest.id), (item) => item.completedAt);
    if (!latestCompletion) return false;
    const attempt = findAttemptForPeriod(attempts.filter((item) => item.questId === quest.id), latestCompletion);
    if (!attempt) return false;
    return new Date(attempt.expiresAt).getTime() > now;
  };
  const activeQuests = quests.filter((quest) => getActiveQuestAttempt(attempts, studentId, quest.id, nowDate));
  const completedQuests = quests.filter((quest) => completionIsCurrent(quest) && !getActiveQuestAttempt(attempts, studentId, quest.id, nowDate));
  const availableQuests = quests.filter((quest) => !completionIsCurrent(quest) && !getActiveQuestAttempt(attempts, studentId, quest.id, nowDate));

  const renderQuestCard = (quest: Quest) => {
    const activeAttempt = getActiveQuestAttempt(attempts, studentId, quest.id, nowDate);
    const latestCompletion = newestByDate(completions.filter((item) => item.questId === quest.id), (item) => item.completedAt);
    const latestAward = newestByDate(awards.filter((item) => item.questId === quest.id), (item) => item.createdAt);
    const latestProgress = newestByDate(progress.filter((item) => item.questId === quest.id), (item) => item.updatedAt);
    const questAttempts = attempts.filter((attempt) => attempt.questId === quest.id);
    const historicalAttempt = findAttemptForPeriod(questAttempts, latestCompletion)
      ?? findAttemptForPeriod(questAttempts, latestAward)
      ?? findAttemptForPeriod(questAttempts, latestProgress);
    const historicalAttemptIsCurrent = historicalAttempt ? new Date(historicalAttempt.expiresAt).getTime() > now : false;
    const attempt = activeAttempt ?? (historicalAttemptIsCurrent ? historicalAttempt : undefined);
    const completion = attempt ? selectQuestCompletion({ quest, completions, attempt }) ?? latestCompletion : undefined;
    const award = attempt ? selectPendingQuestAward({ quest, awards, attempt }) ?? latestAward : undefined;
    const selectedProgress = attempt ? selectQuestProgress({ quest, progress, completion, attempt }) : undefined;

    return (
      <LichessQuestProgressCard
        key={quest.id}
        quest={quest}
        progress={selectedProgress}
        award={award}
        completion={completion}
        attempt={attempt}
        now={now}
        onStart={() => startQuest(quest)}
      />
    );
  };

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-black text-white">Live Quests</h2>
            <p className="mt-1 text-sm text-slate-400">Start any live quest when you are ready. {message}</p>
          </div>
          <Button onClick={evaluate} disabled={syncing} variant="secondary">{syncing ? "Syncing..." : "Sync Lichess"}</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availableQuests.map(renderQuestCard)}
        </div>
        {availableQuests.length === 0 && activeQuests.length === 0 && completedQuests.length === 0 && (
          <Card className="p-4 text-sm text-slate-300">No live Lichess quests are available right now.</Card>
        )}
        {availableQuests.length === 0 && (activeQuests.length > 0 || completedQuests.length > 0) && (
          <Card className="p-4 text-sm text-slate-300">No new live quests are ready to start right now.</Card>
        )}
      </section>
      {activeQuests.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-white">Started Quests</h2>
              <p className="mt-1 text-sm text-slate-400">These timers are already running. Finish them before the countdown ends.</p>
            </div>
            <span className="rounded bg-cyan-300/15 px-2 py-1 text-xs font-black text-cyan-100">{activeQuests.length} active</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeQuests.map(renderQuestCard)}
          </div>
        </section>
      )}
      {completedQuests.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-white">Completed Quests</h2>
              <p className="mt-1 text-sm text-slate-400">XP has already been awarded for these quest attempts.</p>
            </div>
            <span className="rounded bg-emerald-300/15 px-2 py-1 text-xs font-black text-emerald-100">{completedQuests.length} done</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {completedQuests.map(renderQuestCard)}
          </div>
        </section>
      )}
    </div>
  );
}
