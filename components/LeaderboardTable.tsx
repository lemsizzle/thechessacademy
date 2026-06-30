"use client";

import { LevelBadge } from "@/components/LevelBadge";
import { allBadges } from "@/data/badges";
import { xpEvents } from "@/data/xpEvents";
import { getTacticProgressCount } from "@/lib/lichess";
import { findStudentLichessAccount, getStudentXpWithLichess } from "@/lib/lichessXp";
import { readAdminStore } from "@/lib/mockStorage";
import type { Student, StudentLichessAccount, StudentTacticProgress, TacticTheme, XpEvent } from "@/lib/types";
import { getLevelAvatarSymbol, getLevelFromXp } from "@/lib/xp";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TimeWindow = "week" | "month" | "all";
type Focus = "Overall XP" | TacticTheme;

const tacticOptions: TacticTheme[] = ["Fork", "Pin", "Skewer", "Discovered Attack", "Double Attack", "Deflection", "Decoy", "Removing the Defender", "Back Rank Mate", "Mate in One"];
const timeOptions: Array<{ value: TimeWindow; label: string }> = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" }
];

function isInsideWindow(dateText: string, timeWindow: TimeWindow) {
  if (timeWindow === "all") return true;
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const days = timeWindow === "week" ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return date >= start;
}

function getStudentXpScore(student: Student, timeWindow: TimeWindow, events: XpEvent[], account?: StudentLichessAccount) {
  if (timeWindow === "all") return getStudentXpWithLichess(student, account).totalXp;
  return events
    .filter((event) => event.studentId === student.id && isInsideWindow(event.createdAt, timeWindow))
    .reduce((total, event) => total + event.amount, 0);
}

function getStudentTacticScore(studentId: string, focus: Focus, timeWindow: TimeWindow, tacticProgress: StudentTacticProgress[]) {
  if (focus === "Overall XP") return 0;
  return tacticProgress
    .filter((item) => (
      item.studentId === studentId &&
      item.tacticTheme === focus &&
      (timeWindow === "all" || !item.updatedAt || isInsideWindow(item.updatedAt, timeWindow))
    ))
    .reduce((total, item) => total + getTacticProgressCount(item), 0);
}

export function LeaderboardTable({
  students,
  tacticProgress,
  lichessAccounts,
  xpEvents: initialXpEvents,
  badges = allBadges,
  profileBasePath = "/app/students",
  linkMode = "profile"
}: {
  students: Student[];
  tacticProgress: StudentTacticProgress[];
  lichessAccounts: StudentLichessAccount[];
  xpEvents?: XpEvent[];
  badges?: typeof allBadges;
  profileBasePath?: string;
  linkMode?: "profile" | "admin";
}) {
  const [classGroup, setClassGroup] = useState("All");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [focus, setFocus] = useState<Focus>("Overall XP");
  const [recentXpEvents, setRecentXpEvents] = useState<XpEvent[]>(initialXpEvents ?? xpEvents);

  useEffect(() => {
    const store = readAdminStore();
    const combinedEvents = [
      ...(store.xpEvents ?? []),
      ...(store.questXpEvents ?? []),
      ...(store.tournamentXpEvents ?? []),
      ...(initialXpEvents ?? xpEvents)
    ];
    const uniqueEvents = Array.from(new Map(combinedEvents.map((event) => [event.id, event])).values());
    setRecentXpEvents(uniqueEvents);
  }, [initialXpEvents]);
  const groups = ["All", ...Array.from(new Set(students.map((student) => student.classGroup)))];
  const ranked = useMemo(() => {
    const filtered = classGroup === "All" ? students : students.filter((student) => student.classGroup === classGroup);
    return filtered
      .map((student) => {
        const account = findStudentLichessAccount(student, lichessAccounts);
        const xp = getStudentXpWithLichess(student, account);
        const score = focus === "Overall XP"
          ? getStudentXpScore(student, timeWindow, recentXpEvents, account)
          : getStudentTacticScore(student.id, focus, timeWindow, tacticProgress);
        return { ...student, score, effectiveXp: xp.totalXp, lichessXp: xp.lichessXp };
      })
      .sort((a, b) => b.score - a.score || b.effectiveXp - a.effectiveXp || a.name.localeCompare(b.name))
      .map((student, index) => ({ ...student, rank: index + 1 }));
  }, [classGroup, focus, lichessAccounts, recentXpEvents, students, tacticProgress, timeWindow]);
  const podium = ranked.slice(0, 3);
  const scoreLabel = focus === "Overall XP" ? (timeWindow === "all" ? "Total XP" : "XP Earned") : `${focus} Tactics`;
  const getStudentHref = (student: Student) => (
    linkMode === "admin"
      ? `/admin/students?student=${encodeURIComponent(student.slug)}`
      : `${profileBasePath}/${student.slug}`
  );

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/58">
      <div className="border-b border-white/10 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-black text-white">Class Leaderboard</h2>
            <p className="mt-1 text-sm text-slate-400">{scoreLabel} · {timeOptions.find((option) => option.value === timeWindow)?.label} · {classGroup}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[620px]">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Class
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={classGroup} onChange={(event) => setClassGroup(event.target.value)}>
                {groups.map((group) => <option key={group}>{group}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Time
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={timeWindow} onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}>
                {timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Focus
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={focus} onChange={(event) => setFocus(event.target.value as Focus)}>
                <option>Overall XP</option>
                {tacticOptions.map((theme) => <option key={theme}>{theme}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {podium.map((student) => {
            const level = getLevelFromXp(student.effectiveXp);
            return (
              <Link key={student.id} href={getStudentHref(student)} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 p-3 transition hover:border-cyan-200/50 hover:bg-cyan-300/10">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-black text-slate-950">#{student.rank}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-cyan-200/90 text-lg text-slate-950">{getLevelAvatarSymbol(level)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-black text-white">{student.name}</span>
                  <span className="text-xs font-bold text-cyan-100">{student.score.toLocaleString()} {focus === "Overall XP" ? "XP" : "found"}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">{scoreLabel}</th>
              <th className="px-4 py-3">Latest Badge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {ranked.map((student) => {
              const latestBadge = badges.find((badge) => student.badgeIds.includes(badge.id));
              const level = getLevelFromXp(student.effectiveXp);
              return (
                <tr key={student.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-4 font-black text-amber-100">#{student.rank}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-cyan-200/90 text-xl font-black text-slate-950">{getLevelAvatarSymbol(level)}</span>
                      <div className="min-w-0">
                        <Link href={getStudentHref(student)} className="font-bold text-white transition hover:text-amber-100">
                          {student.name}
                        </Link>
                        <Link href={getStudentHref(student)} className="mt-1 block w-fit text-xs font-bold text-cyan-200 transition hover:text-cyan-100 hover:underline">
                          ID: {student.lichessUsername ?? student.slug}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{student.classGroup}</td>
                  <td className="px-4 py-4"><LevelBadge level={level} /></td>
                  <td className="px-4 py-4">
                    <span className="font-black text-slate-100">{student.score.toLocaleString()}</span>
                    {focus === "Overall XP" && student.lichessXp > 0 && <span className="ml-2 text-xs text-cyan-200">+{student.lichessXp.toLocaleString()} Lichess</span>}
                    {focus !== "Overall XP" && <span className="ml-2 text-xs text-slate-500">found</span>}
                  </td>
                  <td className="px-4 py-4 text-slate-300">{latestBadge?.name ?? "No badge yet"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
