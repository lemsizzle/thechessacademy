import { LeaderboardBoard } from "@/components/LeaderboardBoard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getBadgesResult } from "@/lib/data/badges";
import { getStudentsResult } from "@/lib/data/students";
import { getXpEventsResult } from "@/lib/data/xpEvents";

export const dynamic = "force-dynamic";

export default async function StudentLeaderboardPage() {
  const [students, xpEvents, badges] = await Promise.all([
    getStudentsResult(),
    getXpEventsResult(),
    getBadgesResult()
  ]);
  const avatarDisplay = await getStudentAvatarDisplayData(students.data.map((student) => student.id));

  return (
    <StudentPortalShell title="Leaderboard" subtitle="Class rankings without leaving your student portal.">
      <LeaderboardBoard
        initialStudents={students.data}
        initialXpEvents={xpEvents.data}
        badges={badges.data}
        avatarItems={avatarDisplay.items}
        studentAvatars={avatarDisplay.avatars}
        profileBasePath="/student/students"
      />
    </StudentPortalShell>
  );
}
