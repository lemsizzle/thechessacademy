"use client";

import { Card } from "@/components/Card";
import { LinkedLichessCard } from "@/components/student/LinkedLichessCard";
import { StudentProfileSettings } from "@/components/student/StudentProfileSettings";
import { StudentProfile } from "@/components/StudentProfile";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { students as seedStudents } from "@/data/students";
import { getCurrentStudentUser } from "@/lib/auth/getCurrentUser";
import { readAdminStore } from "@/lib/mockStorage";
import { useEffect, useState } from "react";
import type { Student, StudentLichessAccount } from "@/lib/types";

export function StudentProfilePrivateLoader() {
  const [student, setStudent] = useState<Student | undefined>();
  const [account, setAccount] = useState<StudentLichessAccount | undefined>();
  const supabaseBackedApp = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  useEffect(() => {
    async function loadProfile() {
      const user = getCurrentStudentUser();
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
        if (supabaseBackedApp) {
          window.location.href = "/";
          return;
        }
      }

      const store = readAdminStore();
      current = current ?? (!supabaseBackedApp ? (store.students ?? seedStudents).find((item) => item.id === user?.studentId) : undefined);
      setStudent(current);
      setAccount((store.studentLichessAccounts ?? seedAccounts).find((item) => item.studentId === current?.id || item.lichessUsername.toLowerCase() === user?.lichessUsername?.toLowerCase()));
    }

    void loadProfile();
  }, []);

  if (!student) return <Card className="p-4 text-sm text-slate-300">No student record found.</Card>;
  return (
    <div className="space-y-5">
      <StudentProfileSettings student={student} />
      <LinkedLichessCard account={account} />
      <StudentProfile key={`${account?.updatedAt ?? "profile"}-${account?.blitzRating ?? 0}-${account?.rapidRating ?? 0}-${account?.puzzleRating ?? 0}-${account?.puzzleGames ?? 0}`} student={student} showAdminControls={false} profileBasePath="/student/students" />
    </div>
  );
}
