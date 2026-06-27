import { AppShell } from "@/components/AppShell";
import { LeaderboardBoard } from "@/components/LeaderboardBoard";

export default function LeaderboardPage() {
  return (
    <AppShell title="Leaderboard" subtitle="Rankings by XP, with class filters for parents, students, and the teacher.">
      <LeaderboardBoard />
    </AppShell>
  );
}
