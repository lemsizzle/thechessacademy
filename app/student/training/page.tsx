import { Suspense } from "react";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleSurvival } from "@/components/training/PuzzleSurvival";
import { AdaptiveReviewTrainer } from "@/chess/components/AdaptiveReviewTrainer";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { getStudentPuzzleTrainingOverview } from "@/lib/puzzle-training/overviewServer";

export const dynamic = "force-dynamic";

export default async function StudentPuzzleTrainingPage() {
  const student = await requireActiveStudent();
  const overview = await getStudentPuzzleTrainingOverview(student.studentId);

  return (
    <StudentPortalShell title="Puzzle Training" subtitle="Survive the academy tactics trial. Three chances. One move at a time.">
      <div className="space-y-6">
        <Suspense fallback={<div className="rounded-lg border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">Preparing puzzle training...</div>}>
          <PuzzleSurvival initialOverview={overview} />
        </Suspense>
        <AdaptiveReviewTrainer />
      </div>
    </StudentPortalShell>
  );
}
