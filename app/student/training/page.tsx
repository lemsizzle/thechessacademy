import { Suspense } from "react";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleSurvival } from "@/components/training/PuzzleSurvival";
import { requireStudentPage as requireActiveStudent } from "@/lib/auth/requireStudentPage";
import { getPuzzleTrainingStartup } from "@/lib/puzzle-training/overviewServer";
import { sessionToStudentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StudentPuzzleTrainingPage() {
  const student = await requireActiveStudent();
  return (
    <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Train">
      <Suspense fallback={<p role="status" className="p-5 text-slate-300">Preparing puzzle training…</p>}>
        <TrainingContent studentId={student.studentId} />
      </Suspense>
    </StudentPortalShell>
  );
}

async function TrainingContent({ studentId }: { studentId: string }) {
  return <PuzzleSurvival initialOverview={await getPuzzleTrainingStartup(studentId)} />;
}
