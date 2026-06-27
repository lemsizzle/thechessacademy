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

  useEffect(() => {
    const user = getCurrentStudentUser();
    const store = readAdminStore();
    const current = (store.students ?? seedStudents).find((item) => item.id === user?.studentId);
    setStudent(current);
    setAccount((store.studentLichessAccounts ?? seedAccounts).find((item) => item.studentId === current?.id));
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
