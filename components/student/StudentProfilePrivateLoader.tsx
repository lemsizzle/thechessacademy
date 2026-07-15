"use client";

import { Card } from "@/components/Card";
import { LinkedLichessCard } from "@/components/student/LinkedLichessCard";
import { StudentCoinsBalanceCard } from "@/components/student/StudentCoinsBalanceCard";
import { StudentProfileSettings } from "@/components/student/StudentProfileSettings";
import { StudentProfile } from "@/components/StudentProfile";
import { allBadges } from "@/data/badges";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { students as seedStudents } from "@/data/students";
import { getCurrentStudentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_STORE_UPDATED_EVENT, readAdminStore } from "@/lib/mockStorage";
import { STUDENT_LICHESS_FULL_SYNC_EVENT } from "@/lib/studentLichessFullSync";
import { STUDENT_LICHESS_SYNC_EVENT } from "@/lib/studentLichessAccountStore";
import { useEffect, useState } from "react";
import type { Badge, Student, StudentLichessAccount } from "@/lib/types";

export function StudentProfilePrivateLoader() {
  const [student, setStudent] = useState<Student | undefined>();
  const [account, setAccount] = useState<StudentLichessAccount | undefined>();
  const [badges, setBadges] = useState<Badge[]>(allBadges);
  const [loaded, setLoaded] = useState(false);
  const supabaseBackedApp = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const allowLocalMockSession = process.env.NODE_ENV !== "production" && !supabaseBackedApp;

  useEffect(() => {
    function refreshFromStore(studentId?: string) {
      if (!studentId) return;
      const store = readAdminStore();
      const nextStudent = (store.students ?? seedStudents).find((item) => item.id === studentId);
      if (nextStudent) {
        setStudent((current) => current ? {
          ...nextStudent,
          ...current,
          totalXp: Math.max(nextStudent.totalXp, current.totalXp),
          badgeIds: Array.from(new Set([...current.badgeIds, ...nextStudent.badgeIds])),
          completedQuestIds: Array.from(new Set([...(current.completedQuestIds ?? []), ...(nextStudent.completedQuestIds ?? [])]))
        } : nextStudent);
      }
      setAccount((store.studentLichessAccounts ?? seedAccounts).find((item) => item.studentId === studentId));
    }

    async function loadProfile() {
      const user = allowLocalMockSession ? getCurrentStudentUser() : null;
      let current: Student | undefined;

      try {
        const response = await fetch("/api/student/profile", { cache: "no-store" });
        const data = await response.json() as { student?: Student | null; needsOnboarding?: boolean };
        if (data.needsOnboarding) {
          window.location.href = "/student/onboarding";
          return;
        }
        current = data.student ?? undefined;
      } catch {
        if (!allowLocalMockSession) {
          window.location.href = "/";
          return;
        }
      }

      const store = readAdminStore();
      try {
        const badgesResponse = await fetch("/api/badges", { cache: "no-store" });
        const badgesData = await badgesResponse.json() as { data?: Badge[] };
        if (badgesData.data?.length) setBadges(badgesData.data);
      } catch {
        setBadges(store.badges ?? allBadges);
      }
      current = current ?? (allowLocalMockSession ? (store.students ?? seedStudents).find((item) => item.id === user?.studentId) : undefined);
      setStudent(current);
      setAccount((store.studentLichessAccounts ?? seedAccounts).find((item) => item.studentId === current?.id));
      setLoaded(true);
    }

    void loadProfile();
    function handleSync(event: Event) {
      const detail = (event as CustomEvent<StudentLichessAccount | { user?: { studentId?: string } }>).detail;
      const eventStudentId = detail && "studentId" in detail ? detail.studentId : detail?.user?.studentId;
      refreshFromStore(eventStudentId ?? student?.id);
    }
    window.addEventListener(STUDENT_LICHESS_SYNC_EVENT, handleSync);
    window.addEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, handleSync);
    window.addEventListener(ADMIN_STORE_UPDATED_EVENT, handleSync);
    return () => {
      window.removeEventListener(STUDENT_LICHESS_SYNC_EVENT, handleSync);
      window.removeEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, handleSync);
      window.removeEventListener(ADMIN_STORE_UPDATED_EVENT, handleSync);
    };
  }, [student?.id]);

  if (!loaded) return <Card className="p-4 text-sm text-slate-300">Loading student dashboard...</Card>;
  if (!student) return <Card className="p-4 text-sm text-slate-300">No student record found. Try logging out and logging in with Lichess again.</Card>;
  return (
    <div className="space-y-5">
      <StudentCoinsBalanceCard />
      <StudentProfileSettings student={student} />
      <LinkedLichessCard account={account} />
      <StudentProfile key={`${account?.updatedAt ?? "profile"}-${account?.blitzRating ?? 0}-${account?.rapidRating ?? 0}-${account?.puzzleRating ?? 0}-${account?.puzzleGames ?? 0}`} student={student} badges={badges} showAdminControls={false} profileBasePath="/student/students" />
    </div>
  );
}
