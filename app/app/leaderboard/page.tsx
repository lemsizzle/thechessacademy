import { AppShell } from "@/components/AppShell";
import { DevDataSourceNote } from "@/components/DevDataSourceNote";
import { LeaderboardBoard } from "@/components/LeaderboardBoard";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getBadgesResult } from "@/lib/data/badges";
import { getStudentsResult } from "@/lib/data/students";
import { getXpEventsResult } from "@/lib/data/xpEvents";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [students, xpEvents, badges] = await Promise.all([
    getStudentsResult(),
    getXpEventsResult(),
    getBadgesResult()
  ]);
  const avatarDisplay = await getStudentAvatarDisplayData(students.data.map((student) => student.id));

  return (
    <AppShell title="Leaderboard" subtitle="Rankings by XP, with class filters for parents, students, and the teacher.">
      <DevDataSourceNote show={students.source === "mock" || xpEvents.source === "mock" || badges.source === "mock"} />
      <LeaderboardBoard initialStudents={students.data} initialXpEvents={xpEvents.data} badges={badges.data} avatarItems={avatarDisplay.items} studentAvatars={avatarDisplay.avatars} />
    </AppShell>
  );
}
