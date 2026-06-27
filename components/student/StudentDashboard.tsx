"use client";

import { BadgeCard } from "@/components/BadgeCard";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LinkedLichessCard } from "@/components/student/LinkedLichessCard";
import { XpBar } from "@/components/XpBar";
import { StudentTournamentSummary } from "@/components/tournaments/StudentTournamentSummary";
import { allBadges } from "@/data/badges";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { studentGameSubmissions as seedGameSubmissions, studentScoreSubmissions as seedScoreSubmissions } from "@/data/studentSubmissions";
import { students as seedStudents } from "@/data/students";
import { mockArenaTournamentResults } from "@/data/tournamentResults";
import { getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { getStudentXpWithLichess } from "@/lib/lichessXp";
import { readAdminStore } from "@/lib/mockStorage";
import { STUDENT_LICHESS_SYNC_EVENT } from "@/lib/studentLichessAccountStore";
import { getStudentArenaPoints } from "@/lib/tournaments/getStudentArenaPoints";
import { getClosestNextTacticBadge } from "@/lib/tacticProgress";
import { getLevelFromXp, getLevelTitle } from "@/lib/xp";
import { useEffect, useMemo, useState } from "react";
import type { Student, StudentGameSubmission, StudentLichessAccount, StudentScoreSubmission, StudentUser } from "@/lib/types";

export function StudentDashboard() {
  const [student, setStudent] = useState<Student | undefined>();
  const [lichessAccount, setLichessAccount] = useState<StudentLichessAccount | undefined>();
  const [gameSubmissions, setGameSubmissions] = useState<StudentGameSubmission[]>([]);
  const [scoreSubmissions, setScoreSubmissions] = useState<StudentScoreSubmission[]>([]);
  const [arenaPoints, setArenaPoints] = useState({ totalPoints: 0, tournamentsPlayed: 0 });
  const [loaded, setLoaded] = useState(false);
  const supabaseBackedApp = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      let user: StudentUser | null = null;
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await response.json() as { user?: StudentUser };
        user = response.ok ? data.user ?? null : null;
        if (user) setCurrentStudentUserRecord(user);
      } catch {
        user = null;
      }
      user = user ?? getCurrentStudentUser();

      let supabaseStudent: Student | undefined;
      if (user) {
        try {
          const profileResponse = await fetch("/api/student/profile", { cache: "no-store" });
          const profileData = await profileResponse.json() as { student?: Student | null; needsOnboarding?: boolean; user?: StudentUser };
          if (profileData.user) {
            user = profileData.user;
            setCurrentStudentUserRecord(profileData.user);
          }
          if (profileData.needsOnboarding) {
            window.location.href = "/student/onboarding";
            return;
          }
          supabaseStudent = profileData.student ?? undefined;
        } catch {
          if (supabaseBackedApp) {
            window.location.href = "/login";
            return;
          }
        }
      }

      if (cancelled) return;
      const store = readAdminStore();
      const students = store.students ?? seedStudents;
      const accounts = store.studentLichessAccounts ?? seedAccounts;
      const account = accounts.find((item) => item.studentId === user?.studentId || item.lichessUsername.toLowerCase() === user?.lichessUsername?.toLowerCase());
      const current = supabaseStudent ?? (!supabaseBackedApp ? students.find((item) => item.id === user?.studentId) : undefined) ?? (!supabaseBackedApp && user ? {
        id: user.studentId,
        slug: user.lichessUsername ?? user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        lichessUsername: user.lichessUsername,
        name: user.name,
        avatar: user.name.slice(0, 1).toUpperCase(),
        classGroup: "Unassigned",
        isActive: true,
        onboardingCompleted: user.onboardingCompleted,
        totalXp: 0,
        badgeIds: [],
        completedQuestIds: [],
        encouragement: "Welcome to the academy. Complete onboarding if your teacher has not placed you in a class yet."
      } satisfies Student : undefined);
      setStudent(current);
      setLichessAccount(account);
      setArenaPoints(getStudentArenaPoints(account, store.arenaTournamentResults ?? mockArenaTournamentResults));
      setGameSubmissions((store.studentGameSubmissions ?? seedGameSubmissions).filter((item) => item.studentId === current?.id));
      setScoreSubmissions((store.studentScoreSubmissions ?? seedScoreSubmissions).filter((item) => item.studentId === current?.id));
      setLoaded(true);
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleSync(event: Event) {
      const detail = (event as CustomEvent<StudentLichessAccount>).detail;
      setLichessAccount((current) => {
        if (detail.studentId !== student?.id && detail.studentId !== current?.studentId) return current;
        setArenaPoints(getStudentArenaPoints(detail, readAdminStore().arenaTournamentResults ?? mockArenaTournamentResults));
        return detail;
      });
    }

    window.addEventListener(STUDENT_LICHESS_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(STUDENT_LICHESS_SYNC_EVENT, handleSync);
  }, [student?.id]);

  const earned = useMemo(() => allBadges.filter((badge) => student?.badgeIds.includes(badge.id)), [student]);
  const nextBadge = student ? getClosestNextTacticBadge(student.id) : undefined;
  const pendingCount = [...gameSubmissions, ...scoreSubmissions].filter((item) => item.status === "pending").length;

  if (!loaded) return <Card className="p-4 text-sm text-slate-300">Loading student dashboard...</Card>;
  if (!student) return <Card className="p-4 text-sm text-slate-300">No student record found. Try logging out and logging in with Lichess again.</Card>;
  const xp = getStudentXpWithLichess(student, lichessAccount);
  const level = getLevelFromXp(xp.totalXp);
  const levelTitle = getLevelTitle(level);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">{student.name}</h2>
            <p className="mt-1 text-sm text-slate-300">{student.classGroup} - Level {level} {levelTitle.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/student/submit" variant="secondary">Submit Work</Button>
            <Button href="/student/submissions" variant="ghost">My Submissions</Button>
            <Button href="/student/resources" variant="ghost">Resources</Button>
          </div>
        </div>
        <div className="mt-4 max-w-2xl">
          <XpBar xp={xp.totalXp} />
          {xp.lichessXp > 0 && (
            <p className="mt-2 text-xs font-bold text-cyan-100">
              Base {xp.baseXp.toLocaleString()} XP + {xp.lichessXp.toLocaleString()} Lichess XP
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">XP</p>
          <p className="mt-2 text-2xl font-black text-white">{xp.totalXp.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">{xp.baseXp.toLocaleString()} base + {xp.lichessXp.toLocaleString()} Lichess</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Blitz</p>
          <p className="mt-2 text-2xl font-black text-white">{lichessAccount?.blitzRating ?? "Not synced"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Rapid</p>
          <p className="mt-2 text-2xl font-black text-white">{lichessAccount?.rapidRating ?? "Not synced"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Puzzle</p>
          <p className="mt-2 text-2xl font-black text-white">{lichessAccount?.puzzleRating ?? "Not synced"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Arena Points</p>
          <p className="mt-2 text-2xl font-black text-white">{arenaPoints.totalPoints}</p>
          <p className="mt-1 text-xs text-slate-400">{arenaPoints.tournamentsPlayed} after first login</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Earned Badges</p>
          <p className="mt-2 text-2xl font-black text-white">{earned.length}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <LinkedLichessCard account={lichessAccount} showXpSummary />
        <Card className="p-4">
          <p className="text-xs font-black uppercase text-slate-400">Pending Submissions</p>
          <p className="mt-2 text-2xl font-black text-white">{pendingCount}</p>
        </Card>
      </div>
      <StudentTournamentSummary student={student} />

      {nextBadge && (
        <Card className="p-4">
          <h2 className="font-black text-white">Next Badge Progress</h2>
          <p className="mt-2 text-sm text-slate-300">{nextBadge.badge.name}: {nextBadge.progress.totalCount ?? nextBadge.progress.puzzlesSolved} / {nextBadge.badge.requiredPuzzleCount}</p>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-white">Earned Badges</h2>
        {earned.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {earned.slice(0, 6).map((badge) => <BadgeCard key={badge.id} badge={badge} earned statusText="Earned" />)}
          </div>
        ) : (
          <Card className="p-4 text-sm text-slate-300">No earned badges yet.</Card>
        )}
      </section>
    </div>
  );
}
