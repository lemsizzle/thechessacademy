"use client";

import { EmptyState } from "@/components/EmptyState";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { useMockAdminState } from "@/lib/useMockAdminState";

export function LeaderboardBoard({ profileBasePath = "/app/students" }: { profileBasePath?: string }) {
  const { students, studentTacticProgress, studentLichessAccounts } = useMockAdminState();

  if (!students.length) {
    return <EmptyState title="No leaderboard yet" message="Add students from the teacher dashboard to begin ranking XP." />;
  }

  return <LeaderboardTable students={students} tacticProgress={studentTacticProgress} lichessAccounts={studentLichessAccounts} profileBasePath={profileBasePath} />;
}
