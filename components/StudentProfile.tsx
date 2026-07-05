"use client";

import { BadgeCard } from "@/components/BadgeCard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LichessStudentConnectPanel } from "@/components/LichessStudentConnectPanel";
import { LichessRatingsSummary } from "@/components/lichess/LichessRatingsSummary";
import { StudentCallingCard } from "@/components/StudentCallingCard";
import { StudentActivityTimeline } from "@/components/StudentActivityTimeline";
import { StudentTournamentSummary } from "@/components/tournaments/StudentTournamentSummary";
import { StudentLichessQuestSummary } from "@/components/quests/StudentLichessQuestSummary";
import { XpBar } from "@/components/XpBar";
import { allBadges } from "@/data/badges";
import { xpEvents as seedXpEvents } from "@/data/xpEvents";
import { getTacticProgressCount } from "@/lib/lichess";
import { findStudentLichessAccount, getStudentXpWithLichess } from "@/lib/lichessXp";
import { ADMIN_STORE_UPDATED_EVENT, hasAdminSession, readAdminStore } from "@/lib/mockStorage";
import { buildStudentActivityItems } from "@/lib/studentActivity";
import { STUDENT_LICHESS_FULL_SYNC_EVENT } from "@/lib/studentLichessFullSync";
import { STUDENT_LICHESS_SYNC_EVENT } from "@/lib/studentLichessAccountStore";
import { isSafeExternalUrl } from "@/lib/resources";
import { getClosestNextTacticBadge } from "@/lib/tacticProgress";
import { useMockAdminState } from "@/lib/useMockAdminState";
import type { Badge, LichessQuestProgress, Quest, QuestCompletionEvent, Student, StudentQuestAttempt, XpEvent } from "@/lib/types";
import { useEffect, useState, type ReactNode } from "react";

function QuestLogSection({
  title,
  summary,
  defaultOpen = false,
  children
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/58 backdrop-blur">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.04] active:translate-y-px active:bg-white/[0.07]"
      >
        <span>
          <span className="block font-black text-white">{title}</span>
          <span className="mt-1 block text-xs font-bold text-slate-400">{summary}</span>
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-lg font-black text-cyan-100">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="border-t border-white/10 p-4">{children}</div>}
    </div>
  );
}

export function StudentProfile({
  student,
  showAdminControls = true,
  profileBasePath = "/app/students",
  badges = allBadges,
  xpEvents = seedXpEvents,
  quests: initialQuests
}: {
  student: Student;
  showAdminControls?: boolean;
  profileBasePath?: string;
  badges?: Badge[];
  xpEvents?: XpEvent[];
  quests?: Quest[];
}) {
  const { quests: adminQuests, studentLichessAccounts } = useMockAdminState();
  const [localStudents, setLocalStudents] = useState<Student[]>([]);
  const localStudent = localStudents.find((item) => (
    item.id === student.id ||
    item.slug === student.slug ||
    (student.lichessUsername && item.lichessUsername?.toLowerCase() === student.lichessUsername.toLowerCase())
  ));
  const effectiveStudent = localStudent ? {
    ...localStudent,
    ...student,
    totalXp: Math.max(localStudent.totalXp, student.totalXp),
    badgeIds: Array.from(new Set([...student.badgeIds, ...localStudent.badgeIds])),
    completedQuestIds: Array.from(new Set([...(student.completedQuestIds ?? []), ...(localStudent.completedQuestIds ?? [])]))
  } : student;
  const quests = initialQuests ?? adminQuests;
  const [isAdmin, setIsAdmin] = useState(false);
  const [localXpEvents, setLocalXpEvents] = useState<XpEvent[]>([]);
  const [localQuestCompletions, setLocalQuestCompletions] = useState<QuestCompletionEvent[]>([]);
  const [localQuestProgress, setLocalQuestProgress] = useState<LichessQuestProgress[]>([]);
  const [localQuestAttempts, setLocalQuestAttempts] = useState<StudentQuestAttempt[]>([]);
  const lichessAccount = findStudentLichessAccount(effectiveStudent, studentLichessAccounts);
  const xp = getStudentXpWithLichess(effectiveStudent, lichessAccount);
  const earned = badges.filter((badge) => effectiveStudent.badgeIds.includes(badge.id));
  const events = [...localXpEvents, ...xpEvents].filter((event) => event.studentId === effectiveStudent.id);
  const activityItems = buildStudentActivityItems({
    student: effectiveStudent,
    badges,
    quests,
    xpEvents: events,
    questProgress: localQuestProgress,
    questCompletions: localQuestCompletions,
    questAttempts: localQuestAttempts,
    lichessAccount,
    limit: 10
  });
  const nextBadge = getClosestNextTacticBadge(effectiveStudent.id);
  const completedQuests = quests.filter((quest) => effectiveStudent.completedQuestIds?.includes(quest.id));
  const visibleQuests = quests.filter((quest) => quest.isLive || effectiveStudent.completedQuestIds?.includes(quest.id));

  useEffect(() => {
    function loadLocalProfileState() {
    setIsAdmin(hasAdminSession());
    const store = readAdminStore();
    setLocalStudents(store.students ?? []);
    setLocalXpEvents([...(store.xpEvents ?? []), ...(store.questXpEvents ?? []), ...(store.tournamentXpEvents ?? [])]);
    setLocalQuestCompletions(store.questCompletionEvents ?? []);
    setLocalQuestProgress(store.lichessQuestProgress ?? []);
    setLocalQuestAttempts(store.studentQuestAttempts ?? []);
    }

    loadLocalProfileState();
    window.addEventListener(STUDENT_LICHESS_SYNC_EVENT, loadLocalProfileState);
    window.addEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, loadLocalProfileState);
    window.addEventListener(ADMIN_STORE_UPDATED_EVENT, loadLocalProfileState);
    return () => {
      window.removeEventListener(STUDENT_LICHESS_SYNC_EVENT, loadLocalProfileState);
      window.removeEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, loadLocalProfileState);
      window.removeEventListener(ADMIN_STORE_UPDATED_EVENT, loadLocalProfileState);
    };
  }, []);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-5">
          <StudentCallingCard name={effectiveStudent.name} classGroup={effectiveStudent.classGroup} lichessUsername={effectiveStudent.lichessUsername ?? effectiveStudent.slug} xp={xp.totalXp} size="hero" />
          <div className="flex-1">
            {showAdminControls && isAdmin && (
              <div className="mt-3">
                <Button href={`/admin/students?student=${encodeURIComponent(effectiveStudent.slug)}`} variant="secondary">Manage Student</Button>
              </div>
            )}
            <div className="mt-4 max-w-2xl">
              <XpBar xp={xp.totalXp} />
              {xp.lichessXp > 0 && (
                <p className="mt-2 text-xs font-bold text-cyan-100">
                  Base {xp.baseXp.toLocaleString()} XP + {xp.lichessXp.toLocaleString()} Lichess XP
                </p>
              )}
            </div>
          </div>
        </div>
        <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">{effectiveStudent.encouragement}</p>
      </Card>

      <div className="space-y-3">
        <QuestLogSection title="Next Goal" summary={nextBadge ? `${nextBadge.badge.name} is closest` : "No next badge target yet"} defaultOpen>
          {nextBadge ? (
            <div>
              <p className="text-sm font-bold text-amber-100">{nextBadge.badge.name}</p>
              <p className="mt-1 text-sm text-slate-300">
                {getTacticProgressCount(nextBadge.progress)} / {nextBadge.badge.requiredPuzzleCount} {nextBadge.badge.tacticTheme?.toLowerCase()} tactics counted
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-200 to-fuchsia-300"
                  style={{ width: `${Math.min(100, Math.round((getTacticProgressCount(nextBadge.progress) / (nextBadge.badge.requiredPuzzleCount ?? 1)) * 100))}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-300">Solve tactic puzzles to reveal the next badge target.</p>
          )}
        </QuestLogSection>

        <QuestLogSection title="Class Quests" summary={`${completedQuests.length} completed - ${visibleQuests.length} visible`}>
          <div className="grid gap-3 md:grid-cols-2">
            {visibleQuests.map((quest) => {
              const completed = effectiveStudent.completedQuestIds?.includes(quest.id) ?? false;
              const completionUrl = quest.completionUrl?.trim();
              const hasSafeCompletionUrl = completionUrl ? isSafeExternalUrl(completionUrl) : false;
              return (
                <div key={quest.id} className={`rounded-md border p-3 ${completed ? "border-emerald-300/25 bg-emerald-300/10" : "border-cyan-300/20 bg-cyan-300/10"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-white">{quest.title}</p>
                    <span className="rounded bg-white/10 px-2 py-1 text-[11px] font-black uppercase text-slate-200">{completed ? "Done" : "Live"}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{quest.description}</p>
                  <p className="mt-2 text-xs font-bold text-amber-100">{quest.xpReward} XP</p>
                  {hasSafeCompletionUrl && (
                    <div className="mt-3">
                      <Button href={completionUrl} variant="secondary" target="_blank" rel="noopener noreferrer">Open Quest Link</Button>
                    </div>
                  )}
                </div>
              );
            })}
            {visibleQuests.length === 0 && <p className="text-sm text-slate-300">No live or completed quests yet.</p>}
          </div>
        </QuestLogSection>

        <QuestLogSection title="Lichess" summary="Ratings, puzzle sync, and teacher review">
          <div className="space-y-4">
            <LichessStudentConnectPanel student={effectiveStudent} profileBasePath={profileBasePath} />
            <LichessRatingsSummary student={effectiveStudent} compact profileBasePath={profileBasePath} />
            <StudentTournamentSummary student={effectiveStudent} />
            <StudentLichessQuestSummary student={effectiveStudent} />
            <Button href="/student/submit" variant="secondary">Submit Games And Scores</Button>
          </div>
        </QuestLogSection>

        <QuestLogSection title="Earned Badges" summary={`${earned.length} earned`}>
          {earned.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {earned.map((badge) => <BadgeCard key={badge.id} badge={badge} earned statusText={badge.isLegacy ? "Legacy earned" : "Earned"} />)}
            </div>
          ) : (
            <p className="text-sm text-slate-300">No earned badges yet. Solve tactic puzzles to unlock the first Bronze badge.</p>
          )}
        </QuestLogSection>

        <QuestLogSection title="Recent Activity" summary={`${activityItems.length} recent update${activityItems.length === 1 ? "" : "s"}`} defaultOpen>
          <StudentActivityTimeline items={activityItems} />
        </QuestLogSection>
      </div>
    </div>
  );
}
