"use client";

import { EmptyState } from "@/components/EmptyState";
import { StudentProfile } from "@/components/StudentProfile";
import { useMockAdminState } from "@/lib/useMockAdminState";

export function StudentFacingProfileLoader({ slug }: { slug: string }) {
  const { students, loaded } = useMockAdminState();
  const student = students.find((item) => item.slug === slug || item.lichessUsername === slug);

  if (!loaded) return <div className="rounded-lg border border-white/10 bg-slate-950/58 p-4 text-sm text-slate-300">Loading profile...</div>;

  if (!student) {
    return <EmptyState title="Student not found" message="Return to the leaderboard and choose a student from the list." />;
  }

  return <StudentProfile student={student} showAdminControls={false} profileBasePath="/student/students" />;
}
