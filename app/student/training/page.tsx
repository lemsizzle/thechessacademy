import { Suspense } from "react";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleSurvival } from "@/components/training/PuzzleSurvival";
import { AdaptiveReviewTrainer } from "@/chess/components/AdaptiveReviewTrainer";

export default function StudentPuzzleTrainingPage() {
  return (
    <StudentPortalShell title="Puzzle Training" subtitle="Survive the academy tactics trial. Three chances. One move at a time.">
      <div className="space-y-6">
        <AdaptiveReviewTrainer />
        <Suspense fallback={<div className="rounded-lg border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">Preparing puzzle training...</div>}>
          <PuzzleSurvival />
        </Suspense>
      </div>
    </StudentPortalShell>
  );
}
