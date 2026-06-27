"use client";

import { EmptyState } from "@/components/EmptyState";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import type { Badge, Student, XpEvent } from "@/lib/types";
import { useMockAdminState } from "@/lib/useMockAdminState";

export function LeaderboardBoard({
  profileBasePath = "/app/students",
  initialStudents,
  initialXpEvents,
  badges
}: {
  profileBasePath?: string;
  initialStudents?: Student[];
  initialXpEvents?: XpEvent[];
  badges?: Badge[];
}) {
  const { students: adminStudents, studentTacticProgress, studentLichessAccounts } = useMockAdminState();
  const students = initialStudents ?? adminStudents;

  if (!students.length) {
    return <EmptyState title="No leaderboard yet" message="Add students from the teacher dashboard to begin ranking XP." />;
  }

  return (
    <LeaderboardTable
      students={students}
      tacticProgress={studentTacticProgress}
      lichessAccounts={studentLichessAccounts}
      profileBasePath={profileBasePath}
      xpEvents={initialXpEvents}
      badges={badges}
    />
  );
}
