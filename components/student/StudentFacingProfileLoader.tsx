"use client";

import { EmptyState } from "@/components/EmptyState";
import { StudentProfile } from "@/components/StudentProfile";
import type { AvatarItem, Student, StudentAvatarConfig } from "@/lib/types";
import { useMockAdminState } from "@/lib/useMockAdminState";

export function StudentFacingProfileLoader({
  slug,
  initialStudent,
  avatarItems,
  studentAvatar
}: {
  slug: string;
  initialStudent?: Student | null;
  avatarItems?: AvatarItem[];
  studentAvatar?: StudentAvatarConfig;
}) {
  const { students, loaded } = useMockAdminState();
  const student = initialStudent ?? students.find((item) => item.slug === slug || item.lichessUsername === slug);

  if (!initialStudent && !loaded) return <div className="rounded-lg border border-white/10 bg-slate-950/58 p-4 text-sm text-slate-300">Loading profile...</div>;

  if (!student) {
    return <EmptyState title="Student not found" message="Return to the leaderboard and choose a student from the list." />;
  }

  return (
    <StudentProfile
      student={student}
      showAdminControls={false}
      profileBasePath="/student/students"
      avatarItems={avatarItems}
      studentAvatar={studentAvatar}
    />
  );
}
