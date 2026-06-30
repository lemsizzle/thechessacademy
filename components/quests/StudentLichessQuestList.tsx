"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LichessQuestProgressCard } from "@/components/quests/LichessQuestProgressCard";
import { quests as seedQuests } from "@/data/quests";
import { getCurrentStudentUser } from "@/lib/auth/getCurrentUser";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { createStudentQuestAttempt, getActiveQuestAttempt, isQuestAttemptActive } from "@/lib/quests/questAttempts";
import { STUDENT_LICHESS_FULL_SYNC_EVENT, syncStudentLichessEverything } from "@/lib/studentLichessFullSync";
import type { LichessQuestProgress, PendingQuestAward, Quest, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";
import { useEffect, useState } from "react";

function newestByDate<T>(items: T[], getDate: (item: T) => string) {
  return [...items].sort((a, b) => getDate(b).localeCompare(getDate(a)))[0];
}

function getDisplayProgress(questId: string, progress: LichessQuestProgress[], completion?: QuestCompletionEvent, attempt?: StudentQuestAttempt) {
  const questProgress = progress.filter((item) => (
    item.questId === questId
    && (!attempt || (item.sourcePeriodStart === attempt.startedAt && item.sourcePeriodEnd === attempt.expiresAt))
  ));
  if (completion) {
    const matchingPeriod = questProgress.find((item) => (
      item.sourcePeriodStart === completion.sourcePeriodStart
      && item.sourcePeriodEnd === completion.sourcePeriodEnd
    ));
    if (matchingPeriod) return matchingPeriod;
    const completedProgress = newestByDate(questProgress.filter((item) => item.completed), (item) => item.updatedAt);
    if (completedProgress) return completedProgress;
  }
  return newestByDate(questProgress, (item) => item.updatedAt);
}

function findAttemptForPeriod(attempts: StudentQuestAttempt[], period?: { sourcePeriodStart: string; sourcePeriodEnd: string }) {
  if (!period) return undefined;
  return attempts.find((attempt) => (
    attempt.startedAt === period.sourcePeriodStart && attempt.expiresAt === period.sourcePeriodEnd
  ));
}

export function StudentLichessQuestList({ detailed = false }: { detailed?: boolean }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progress, setProgress] = useState<LichessQuestProgress[]>([]);
  const [awards, setAwards] = useState<PendingQuestAward[]>([]);
  const [completions, setCompletions] = useState<QuestCompletionEvent[]>([]);
  const [attempts, setAttempts] = useState<StudentQuestAttempt[]>([]);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("Use one Lichess sync to refresh ratings, games, puzzles, quests, and badge checks.");
  const [syncing, setSyncing] = useState(false);

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
      const otherAttempts = (store.studentQuestAttempts ?? []).filter((item) => item.studentId !== studentId);
      const otherProgress = (store.lichessQuestProgress ?? []).filter((item) => item.studentId !== studentId);
      const otherCompletions = (store.questCompletionEvents ?? []).filter((item) => item.studentId !== studentId);
      updateAdminStore({
        studentQuestAttempts: [...(data.attempts ?? []), ...otherAttempts],
        lichessQuestProgress: [...(data.progress ?? []), ...otherProgress],
        questCompletionEvents: [...(data.completions ?? []), ...otherCompletions]
      });
      setAttempts(data.attempts ?? []);
      setProgress(data.progress ?? []);
      setCompletions(data.completions ?? []);
    } catch {
      // Local quest progress remains available when Supabase tracking is not configured.
    }
  }

  function load() {
    const user = getCurrentStudentUser();
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

    setQuests((store.quests ?? seedQuests).filter((quest) => (
      quest.source?.startsWith("lichess_")
      && quest.isActive !== false
      && (quest.isLive || visibleQuestIds.has(quest.id))
    )));
    setProgress(studentProgress);
    setAwards(studentAwards);
    setCompletions(studentCompletions);
    setAttempts(studentAttempts);
    void refreshPersistedQuestTracking(studentId);
  }

  useEffect(() => {
    load();
    window.addEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, load);
    return () => window.removeEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, load);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function startQuest(quest: Quest) {
    const user = getCurrentStudentUser();
    if (!user) return;
    const store = readAdminStore();
    const previousAttempts = store.studentQuestAttempts ?? [];
    const attempt = createStudentQuestAttempt(user.studentId, quest);
    const nextAttempts = [
      attempt,
      ...previousAttempts.map((item) => (
        item.studentId === user.studentId && item.questId === quest.id && isQuestAttemptActive(item)
          ? { ...item, status: "expired" as const }
          : item
      ))
    ];
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
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sync Lichess.");
    } finally {
      setSyncing(false);
    }
  }

  const studentId = getCurrentStudentUser()?.studentId ?? "";
  const completedQuestIds = new Set(completions.map((item) => item.questId));
  const activeQuests = quests.filter((quest) => getActiveQuestAttempt(attempts, studentId, quest.id, new Date(now)));
  const completedQuests = quests.filter((quest) => completedQuestIds.has(quest.id) && !getActiveQuestAttempt(attempts, studentId, quest.id, new Date(now)));
  const availableQuests = quests.filter((quest) => !completedQuestIds.has(quest.id) && !getActiveQuestAttempt(attempts, studentId, quest.id, new Date(now)));

  const renderQuestCard = (quest: Quest) => {
    const activeAttempt = getActiveQuestAttempt(attempts, studentId, quest.id, new Date(now));
    const latestCompletion = newestByDate(completions.filter((item) => item.questId === quest.id), (item) => item.completedAt);
    const latestAward = newestByDate(awards.filter((item) => item.questId === quest.id), (item) => item.createdAt);
    const latestProgress = newestByDate(progress.filter((item) => item.questId === quest.id), (item) => item.updatedAt);
    const questAttempts = attempts.filter((attempt) => attempt.questId === quest.id);
    const attempt = activeAttempt
      ?? findAttemptForPeriod(questAttempts, latestCompletion)
      ?? findAttemptForPeriod(questAttempts, latestAward)
      ?? findAttemptForPeriod(questAttempts, latestProgress);
    const completion = attempt
      ? newestByDate(completions.filter((item) => item.questId === quest.id && item.sourcePeriodStart === attempt.startedAt && item.sourcePeriodEnd === attempt.expiresAt), (item) => item.completedAt)
      : latestCompletion;
    const award = attempt
      ? newestByDate(awards.filter((item) => item.questId === quest.id && item.sourcePeriodStart === attempt.startedAt && item.sourcePeriodEnd === attempt.expiresAt), (item) => item.createdAt)
      : latestAward;

    return (
      <LichessQuestProgressCard
        key={quest.id}
        quest={quest}
        progress={getDisplayProgress(quest.id, progress, completion, attempt)}
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
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="font-black text-white">Lichess Progress</h2><p className="mt-1 text-sm text-slate-400">{message}</p></div>
          <div className="flex gap-2"><Button onClick={evaluate} disabled={syncing} variant="secondary">{syncing ? "Syncing..." : "Sync Lichess"}</Button>{!detailed && <Button href="/student/lichess-progress" variant="ghost">Details</Button>}</div>
        </div>
      </Card>
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
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-white">Available Quests</h2>
            <p className="mt-1 text-sm text-slate-400">Pick a quest and press Start when you are ready to begin its timer.</p>
          </div>
          <span className="rounded bg-white/10 px-2 py-1 text-xs font-black text-slate-200">{availableQuests.length} ready</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availableQuests.map(renderQuestCard)}
        </div>
        {availableQuests.length === 0 && activeQuests.length === 0 && completedQuests.length === 0 && (
          <Card className="p-4 text-sm text-slate-300">No live Lichess quests are available right now.</Card>
        )}
      </section>
    </div>
  );
}
