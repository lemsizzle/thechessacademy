import { AppShell } from "@/components/AppShell";
import { DevDataSourceNote } from "@/components/DevDataSourceNote";
import { LeaderboardBoard } from "@/components/LeaderboardBoard";
import { getBadgesResult } from "@/lib/data/badges";
import { getStudentsResult } from "@/lib/data/students";
import { getXpEventsResult } from "@/lib/data/xpEvents";

export const dynamic = "force-dynamic";

export default async function AdminLeaderboardPage() {
  const [students, xpEvents, badges] = await Promise.all([
    getStudentsResult(),
    getXpEventsResult(),
    getBadgesResult()
  ]);

  return (
    <AppShell title="Teacher Leaderboard" subtitle="View class rankings from the teacher dashboard. Student links open the admin student editor." variant="admin">
      <DevDataSourceNote show={students.source === "mock" || xpEvents.source === "mock" || badges.source === "mock"} />
      <LeaderboardBoard initialStudents={students.data} initialXpEvents={xpEvents.data} badges={badges.data} linkMode="admin" />
    </AppShell>
  );
}
