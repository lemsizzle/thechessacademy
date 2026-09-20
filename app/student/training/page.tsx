import { Suspense } from "react";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleSurvival } from "@/components/training/PuzzleSurvival";
import { PuzzleTrainingLeaderboard } from "@/components/training/PuzzleTrainingLeaderboard";
import { requireStudentPage as requireActiveStudent } from "@/lib/auth/requireStudentPage";
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
  const overview = await getStudentPuzzleTrainingOverview(studentId);
  return <PuzzleSurvival
    initialOverview={overview}
    statsContent={<PuzzleTrainingLeaderboard viewerStudentId={studentId} />}
  />;
}
