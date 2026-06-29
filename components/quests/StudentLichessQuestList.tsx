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

export function StudentLichessQuestList({ detailed = false }: { detailed?: boolean }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progress, setProgress] = useState<LichessQuestProgress[]>([]);
  const [awards, setAwards] = useState<PendingQuestAward[]>([]);
  const [completions, setCompletions] = useState<QuestCompletionEvent[]>([]);
  const [attempts, setAttempts] = useState<StudentQuestAttempt[]>([]);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("Use one Lichess sync to refresh ratings, games, puzzles, quests, and badge checks.");
  const [syncing, setSyncing] = useState(false);

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
    setMessage(`${quest.title} started. Your countdown is running.`);
    load();
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

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="font-black text-white">Lichess Progress</h2><p className="mt-1 text-sm text-slate-400">{message}</p></div>
          <div className="flex gap-2"><Button onClick={evaluate} disabled={syncing} variant="secondary">{syncing ? "Syncing..." : "Sync Lichess"}</Button>{!detailed && <Button href="/student/lichess-progress" variant="ghost">Details</Button>}</div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quests.map((quest) => {
          const attempt = getActiveQuestAttempt(attempts, getCurrentStudentUser()?.studentId ?? "", quest.id, new Date(now));
          const completion = attempt
            ? newestByDate(completions.filter((item) => item.questId === quest.id && item.sourcePeriodStart === attempt.startedAt && item.sourcePeriodEnd === attempt.expiresAt), (item) => item.completedAt)
            : undefined;
          const award = attempt
            ? newestByDate(awards.filter((item) => item.questId === quest.id && item.sourcePeriodStart === attempt.startedAt && item.sourcePeriodEnd === attempt.expiresAt), (item) => item.createdAt)
            : undefined;
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
        })}
      </div>
    </div>
  );
}
