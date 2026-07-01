"use client";

import { Card } from "@/components/Card";
import { LinkedLichessCard } from "@/components/student/LinkedLichessCard";
import { StudentProfileSettings } from "@/components/student/StudentProfileSettings";
import { StudentProfile } from "@/components/StudentProfile";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { students as seedStudents } from "@/data/students";
import { getCurrentStudentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_STORE_UPDATED_EVENT, readAdminStore } from "@/lib/mockStorage";
import { STUDENT_LICHESS_FULL_SYNC_EVENT } from "@/lib/studentLichessFullSync";
import { STUDENT_LICHESS_SYNC_EVENT } from "@/lib/studentLichessAccountStore";
import { useEffect, useState } from "react";
import type { Student, StudentLichessAccount } from "@/lib/types";

export function StudentProfilePrivateLoader() {
  const [student, setStudent] = useState<Student | undefined>();
  const [account, setAccount] = useState<StudentLichessAccount | undefined>();
  const supabaseBackedApp = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const allowLocalMockSession = process.env.NODE_ENV !== "production" && !supabaseBackedApp;

  useEffect(() => {
    function refreshFromStore(studentId?: string) {
      if (!studentId) return;
      const store = readAdminStore();
      const nextStudent = (store.students ?? seedStudents).find((item) => item.id === studentId);
      if (nextStudent) setStudent(nextStudent);
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
      current = current ?? (allowLocalMockSession ? (store.students ?? seedStudents).find((item) => item.id === user?.studentId) : undefined);
      setStudent(current);
      setAccount((store.studentLichessAccounts ?? seedAccounts).find((item) => item.studentId === current?.id));
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

  if (!student) return <Card className="p-4 text-sm text-slate-300">No student record found.</Card>;
  return (
    <div className="space-y-5">
      <StudentProfileSettings student={student} />
      <LinkedLichessCard account={account} />
      <StudentProfile key={`${account?.updatedAt ?? "profile"}-${account?.blitzRating ?? 0}-${account?.rapidRating ?? 0}-${account?.puzzleRating ?? 0}-${account?.puzzleGames ?? 0}`} student={student} showAdminControls={false} profileBasePath="/student/students" />
    </div>
  );
}
