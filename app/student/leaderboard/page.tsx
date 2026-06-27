import { LeaderboardBoard } from "@/components/LeaderboardBoard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentLeaderboardPage() {
  return (
    <StudentPortalShell title="Leaderboard" subtitle="Class rankings without leaving your student portal.">
      <LeaderboardBoard profileBasePath="/student/students" />
    </StudentPortalShell>
  );
}
