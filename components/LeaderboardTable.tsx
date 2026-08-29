"use client";

import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { LevelBadge } from "@/components/LevelBadge";
import { allBadges } from "@/data/badges";
import { xpEvents } from "@/data/xpEvents";
import { getDefaultEquippedItems, seedAvatarItems } from "@/lib/avatar/catalog";
import { getHideAndSeekLeaderboardScore, hasHideAndSeekLeaderboardScore, type HideAndSeekLeaderboardScore } from "@/lib/leaderboard/hideAndSeek";
import { getStarWarsLeaderboardScore, hasStarWarsLeaderboardScore, type StarWarsLeaderboardScore } from "@/lib/leaderboard/starWars";
import { getSurvivalLeaderboardScore, hasSurvivalLeaderboardScore, survivalLeaderboardScoreKey, type LeaderboardTimeWindow, type SurvivalLeaderboardScore } from "@/lib/leaderboard/survival";
import { findStudentLichessAccount, getStudentXpWithLichess } from "@/lib/lichessXp";
import { readAdminStore } from "@/lib/mockStorage";
import { puzzleThemeOptions, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";
import type { AvatarItem, Student, StudentAvatarConfig, StudentLichessAccount, XpEvent } from "@/lib/types";
import { getLevelFromXp } from "@/lib/xp";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TimeWindow = LeaderboardTimeWindow;
type Focus = "Overall XP" | "Survival Puzzles" | "Hide and Seek" | "Star Wars";

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

export function LeaderboardTable({
  students,
  lichessAccounts,
  survivalScores,
  hideAndSeekScores,
  starWarsScores,
  xpEvents: initialXpEvents,
  badges = allBadges,
  avatarItems = seedAvatarItems,
  studentAvatars = {},
  profileBasePath = "/app/students",
  linkMode = "profile",
  initialFocus = "Overall XP",
  lockFocus = false,
  heading = "Class Leaderboard"
}: {
  students: Student[];
  lichessAccounts: StudentLichessAccount[];
  survivalScores: SurvivalLeaderboardScore[];
  hideAndSeekScores?: HideAndSeekLeaderboardScore[];
  starWarsScores?: StarWarsLeaderboardScore[];
  xpEvents?: XpEvent[];
  badges?: typeof allBadges;
  avatarItems?: AvatarItem[];
  studentAvatars?: Record<string, StudentAvatarConfig>;
  profileBasePath?: string;
  linkMode?: "profile" | "admin";
  initialFocus?: Focus;
  lockFocus?: boolean;
  heading?: string;
}) {
  const [classGroup, setClassGroup] = useState("All");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [focus, setFocus] = useState<Focus>(initialFocus);
  const [survivalTheme, setSurvivalTheme] = useState<PuzzleThemeSlug>("mixed");
  const [recentXpEvents, setRecentXpEvents] = useState<XpEvent[]>(initialXpEvents ?? xpEvents);
  const defaultEquippedItems = useMemo(() => getDefaultEquippedItems(avatarItems), [avatarItems]);
  const survivalScoresByStudentAndTheme = useMemo(() => new Map(survivalScores.map((score) => [survivalLeaderboardScoreKey(score.studentId, score.theme), score])), [survivalScores]);
  const hideAndSeekScoresByStudent = useMemo(() => new Map((hideAndSeekScores ?? []).map((score) => [score.studentId, score])), [hideAndSeekScores]);
  const starWarsScoresByStudent = useMemo(() => new Map((starWarsScores ?? []).map((score) => [score.studentId, score])), [starWarsScores]);
  const hasHideAndSeekFocus = hideAndSeekScores !== undefined;
  const hasStarWarsFocus = starWarsScores !== undefined;

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
      .filter((student) => (
        focus === "Overall XP"
        || (focus === "Survival Puzzles" && hasSurvivalLeaderboardScore(
          survivalScoresByStudentAndTheme.get(survivalLeaderboardScoreKey(student.id, survivalTheme)),
          timeWindow
        ))
        || (focus === "Hide and Seek" && hasHideAndSeekLeaderboardScore(
          hideAndSeekScoresByStudent.get(student.id),
          timeWindow
        ))
        || (focus === "Star Wars" && hasStarWarsLeaderboardScore(
          starWarsScoresByStudent.get(student.id),
          timeWindow
        ))
      ))
      .map((student) => {
        const account = findStudentLichessAccount(student, lichessAccounts);
        const xp = getStudentXpWithLichess(student, account);
        let score = getStudentXpScore(student, timeWindow, recentXpEvents, account);
        if (focus === "Survival Puzzles") {
          score = getSurvivalLeaderboardScore(survivalScoresByStudentAndTheme.get(survivalLeaderboardScoreKey(student.id, survivalTheme)), timeWindow);
        } else if (focus === "Hide and Seek") {
          score = getHideAndSeekLeaderboardScore(hideAndSeekScoresByStudent.get(student.id), timeWindow);
        } else if (focus === "Star Wars") {
          score = getStarWarsLeaderboardScore(starWarsScoresByStudent.get(student.id), timeWindow);
        }
        return { ...student, score, effectiveXp: xp.totalXp, lichessXp: xp.lichessXp };
      })
      .sort((a, b) => b.score - a.score || b.effectiveXp - a.effectiveXp || a.name.localeCompare(b.name))
      .map((student, index) => ({ ...student, rank: index + 1 }));
  }, [classGroup, focus, hideAndSeekScoresByStudent, lichessAccounts, recentXpEvents, starWarsScoresByStudent, students, survivalScoresByStudentAndTheme, survivalTheme, timeWindow]);
  const podium = ranked.slice(0, 3);
  const scoreLabel = focus === "Overall XP"
    ? (timeWindow === "all" ? "Total XP" : "XP Earned")
    : focus === "Survival Puzzles"
      ? "Best Survival Run"
      : focus === "Hide and Seek"
        ? "Best Hide and Seek Score"
        : "Best Star Wars Run";
  const scoreUnit = focus === "Overall XP" ? "XP" : focus === "Survival Puzzles" ? "puzzles" : "points";
  const survivalThemeLabel = survivalTheme === "mixed"
    ? "Mixed themes"
    : puzzleThemeOptions.find((option) => option.id === survivalTheme)?.name ?? "Mixed themes";
  const getStudentHref = (student: Student) => (
    linkMode === "admin"
      ? `/admin/students?student=${encodeURIComponent(student.slug)}`
      : `${profileBasePath}/${student.slug}`
  );
  const getStudentAvatar = (studentId: string): StudentAvatarConfig => (
    studentAvatars[studentId] ?? { studentId, equippedItems: defaultEquippedItems }
  );

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/58">
      <div className="border-b border-white/10 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-black text-white">{heading}</h2>
            <p className="mt-1 text-sm text-slate-400">{scoreLabel} · {timeOptions.find((option) => option.value === timeWindow)?.label} · {classGroup}{focus === "Survival Puzzles" ? ` · ${survivalThemeLabel}` : ""}</p>
          </div>
          <div className={`grid gap-2 sm:grid-cols-2 ${focus === "Survival Puzzles" ? lockFocus ? "xl:min-w-[620px] xl:grid-cols-3" : "xl:min-w-[820px] xl:grid-cols-4" : lockFocus ? "xl:min-w-[420px] xl:grid-cols-2" : "xl:min-w-[620px] xl:grid-cols-3"}`}>
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
            {!lockFocus && (
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Focus
                <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={focus} onChange={(event) => setFocus(event.target.value as Focus)}>
                  <option>Overall XP</option>
                  <option>Survival Puzzles</option>
                  {hasHideAndSeekFocus ? <option>Hide and Seek</option> : null}
                  {hasStarWarsFocus ? <option>Star Wars</option> : null}
                </select>
              </label>
            )}
            {focus === "Survival Puzzles" && (
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Theme
                <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm normal-case text-white" value={survivalTheme} onChange={(event) => setSurvivalTheme(event.target.value as PuzzleThemeSlug)}>
                  {puzzleThemeOptions.map((option) => <option key={option.id} value={option.id}>{option.id === "mixed" ? "Mixed themes" : option.name}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
        {focus === "Hide and Seek" && ranked.length === 0 ? (
          <div className="mt-4 rounded-md border border-violet-200/20 bg-violet-300/[0.06] p-4" role="status">
            <p className="font-black text-white">No Hide and Seek attempts found</p>
            <p className="mt-1 text-sm text-slate-400">No saved attempts match this class and time period yet.</p>
          </div>
        ) : null}
        {focus === "Star Wars" && ranked.length === 0 ? (
          <div className="mt-4 rounded-md border border-violet-200/20 bg-violet-300/[0.06] p-4" role="status">
            <p className="font-black text-white">No Star Wars scores found</p>
            <p className="mt-1 text-sm text-slate-400">No verified runs match this class and time period yet.</p>
          </div>
        ) : null}
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {podium.map((student) => (
              <Link key={student.id} href={getStudentHref(student)} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 p-3 transition hover:border-cyan-200/50 hover:bg-cyan-300/10">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-black text-slate-950">#{student.rank}</span>
                <AvatarRenderer items={avatarItems} avatar={getStudentAvatar(student.id)} size="sm" label={`${student.name}'s avatar`} />
                <span className="min-w-0">
                  <span className="block truncate font-black text-white">{student.name}</span>
                  <span className="text-xs font-bold text-cyan-100">{student.score.toLocaleString()} {scoreUnit}</span>
                </span>
              </Link>
          ))}
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
                      <AvatarRenderer items={avatarItems} avatar={getStudentAvatar(student.id)} size="sm" label={`${student.name}'s avatar`} />
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
                  <td className="px-4 py-4"><LevelBadge level={level} showTitle /></td>
                  <td className="px-4 py-4">
                    <span className="font-black text-slate-100">{student.score.toLocaleString()}</span>
                    {focus === "Overall XP" && student.lichessXp > 0 && <span className="ml-2 text-xs text-cyan-200">+{student.lichessXp.toLocaleString()} Lichess</span>}
                    {focus !== "Overall XP" && <span className="ml-2 text-xs text-slate-500">{scoreUnit}</span>}
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
