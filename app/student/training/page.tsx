import { Suspense } from "react";
import { LeaderboardBoard } from "@/components/LeaderboardBoard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleSurvival } from "@/components/training/PuzzleSurvival";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getStudentsResult } from "@/lib/data/students";
import { getSurvivalLeaderboardScores } from "@/lib/leaderboard/survivalServer";
import { getStudentPuzzleTrainingOverview } from "@/lib/puzzle-training/overviewServer";
import { sessionToStudentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StudentPuzzleTrainingPage() {
  const student = await requireActiveStudent();
  return (
    <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Puzzle Training" subtitle="Train tactics, build pattern memory, and plan perfect routes before you move.">
      <Suspense fallback={<p role="status" className="p-5 text-slate-300">Preparing puzzle training…</p>}>
        <TrainingContent studentId={student.studentId} />
      </Suspense>
    </StudentPortalShell>
  );
}

async function TrainingContent({ studentId }: { studentId: string }) {
  const scores = getSurvivalLeaderboardScores();
  const students = getStudentsResult();
  const overview = await getStudentPuzzleTrainingOverview(studentId, scores);
  return <PuzzleSurvival initialOverview={overview} statsContent={
    <Suspense fallback={<p role="status" className="p-5 text-slate-300">Loading rankings…</p>}>
      <TrainingRankings studentId={studentId} survivalScores={await scores} studentsPromise={students} />
    </Suspense>
  } />;
}

async function TrainingRankings({ studentId, survivalScores, studentsPromise }: { studentId: string; survivalScores: Awaited<ReturnType<typeof getSurvivalLeaderboardScores>>; studentsPromise: ReturnType<typeof getStudentsResult> }) {
  const students = await studentsPromise;
  const avatarDisplay = await getStudentAvatarDisplayData(students.data.map((item) => item.id));

  return (
            <LeaderboardBoard
              initialStudents={students.data}
              avatarItems={avatarDisplay.items}
              studentAvatars={avatarDisplay.avatars}
              survivalScores={survivalScores}
              initialFocus="Survival Puzzles"
              lockFocus
              heading="Survival Puzzle Leaderboard"
              profileBasePath="/student/students"
              enableCorrespondenceChallenges
              viewerStudentId={studentId}
            />
  );
}
