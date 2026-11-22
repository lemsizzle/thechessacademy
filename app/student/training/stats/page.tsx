import { Suspense } from "react";
import Link from "next/link";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleTrainingStats } from "@/components/training/PuzzleTrainingStats";
import { PuzzleTrainingLeaderboard } from "@/components/training/PuzzleTrainingLeaderboard";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";
import { getStudentPuzzleTrainingOverview } from "@/lib/puzzle-training/overviewServer";

export const dynamic = "force-dynamic";
export default async function TrainingStatsPage() {
  const student = await requireStudentPage();
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Training stats">
    <Link href="/student/training" className="mb-4 inline-flex min-h-11 items-center font-bold text-cyan-200">← Back to training</Link>
    <Suspense fallback={<p role="status" className="py-5 text-slate-300">Loading your stats…</p>}><Stats studentId={student.studentId} /></Suspense>
  </StudentPortalShell>;
}
async function Stats({ studentId }: { studentId: string }) {
  const overview = await getStudentPuzzleTrainingOverview(studentId);
  return <PuzzleTrainingStats overview={overview} leaderboard={<PuzzleTrainingLeaderboard viewerStudentId={studentId} />} />;
}
