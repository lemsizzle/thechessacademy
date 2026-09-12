import { LeaderboardBoard } from "@/components/LeaderboardBoard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getBadgesResult } from "@/lib/data/badges";
import { getStudentsResult } from "@/lib/data/students";
import { getXpEventsResult } from "@/lib/data/xpEvents";
import { getHideAndSeekLeaderboardScores } from "@/lib/leaderboard/hideAndSeekServer";
import { getStarWarsLeaderboardScores } from "@/lib/leaderboard/starWarsServer";
import { getSurvivalLeaderboardScores } from "@/lib/leaderboard/survivalServer";
import { requireStudentPage as requireActiveStudent } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function StudentLeaderboardPage() {
  const session = await requireActiveStudent();
  return <StudentPortalShell title="Leaderboard" subtitle="Class rankings without leaving your student portal." initialUser={sessionToStudentUser(session)}>
    <Suspense fallback={<p role="status" className="p-5 text-slate-300">Loading rankings…</p>}>
      <Rankings studentId={session.studentId} />
    </Suspense>
  </StudentPortalShell>;
}

async function Rankings({ studentId }: { studentId: string }) {
  const studentsPromise = getStudentsResult();
  const [students, xpEvents, badges, survivalScores, hideAndSeekScores, starWarsScores, avatarDisplay] = await Promise.all([
    studentsPromise,
    getXpEventsResult(),
    getBadgesResult(),
    getSurvivalLeaderboardScores(),
    getHideAndSeekLeaderboardScores(),
    getStarWarsLeaderboardScores(),
    studentsPromise.then((students) => getStudentAvatarDisplayData(students.data.map((student) => student.id)))
  ]);

  return (
      <LeaderboardBoard
        initialStudents={students.data}
        initialXpEvents={xpEvents.data}
        badges={badges.data}
        avatarItems={avatarDisplay.items}
        studentAvatars={avatarDisplay.avatars}
        survivalScores={survivalScores}
        hideAndSeekScores={hideAndSeekScores}
        starWarsScores={starWarsScores}
        profileBasePath="/student/students"
        enableCorrespondenceChallenges
        viewerStudentId={studentId}
      />
  );
}
