import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleSurvival } from "@/components/training/PuzzleSurvival";

export default function StudentPuzzleTrainingPage() {
  return (
    <StudentPortalShell title="Puzzle Training" subtitle="Survive the academy tactics trial. Three chances. One move at a time.">
      <PuzzleSurvival />
    </StudentPortalShell>
  );
}
