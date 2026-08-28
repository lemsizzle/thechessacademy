import { Suspense } from "react";
import { LeaderboardBoard } from "@/components/LeaderboardBoard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleSurvival } from "@/components/training/PuzzleSurvival";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getStudentsResult } from "@/lib/data/students";
import { getSurvivalLeaderboardScores } from "@/lib/leaderboard/survivalServer";
import { getStudentPuzzleTrainingOverview } from "@/lib/puzzle-training/overviewServer";

export const dynamic = "force-dynamic";

export default async function StudentPuzzleTrainingPage() {
  const student = await requireActiveStudent();
  const [students, survivalScores] = await Promise.all([
    getStudentsResult(),
    getSurvivalLeaderboardScores()
  ]);
  const [overview, avatarDisplay] = await Promise.all([
    getStudentPuzzleTrainingOverview(student.studentId, survivalScores),
    getStudentAvatarDisplayData(students.data.map((item) => item.id))
  ]);

  return (
    <StudentPortalShell title="Puzzle Training" subtitle="Train tactics, build pattern memory, and plan perfect routes before you move.">
      <Suspense fallback={<div className="rounded-lg border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">Preparing puzzle training...</div>}>
        <PuzzleSurvival
          initialOverview={overview}
          statsContent={(
            <LeaderboardBoard
              initialStudents={students.data}
              avatarItems={avatarDisplay.items}
              studentAvatars={avatarDisplay.avatars}
              survivalScores={survivalScores}
              initialFocus="Survival Puzzles"
              lockFocus
              heading="Survival Puzzle Leaderboard"
              profileBasePath="/student/students"
            />
          )}
        />
      </Suspense>
    </StudentPortalShell>
  );
}
