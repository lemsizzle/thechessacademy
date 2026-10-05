import { notFound } from "next/navigation";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleReplay } from "@/components/training/PuzzleReplay";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";
import { dashboardHref, nextReplayPuzzleId, parseDashboardQuery, puzzleReplayHref } from "@/lib/puzzle-training/dashboard";
import { getPuzzleDashboard, hasPuzzleHistory } from "@/lib/puzzle-training/dashboardServer";
import { preparePublicTrainingPuzzle } from "@/lib/puzzle-training/publicPuzzle";
import { getTrainingPuzzle } from "@/lib/puzzle-training/server";

export const dynamic = "force-dynamic";

export default async function ReplayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const student = await requireStudentPage();
  const { id } = await params;
  if (!await hasPuzzleHistory(student.studentId, id)) notFound();
  const search = await searchParams;
  const query = { ...parseDashboardQuery(search), view: "replay" as const, outcome: "all" as const, page: 1 };
  const [puzzle, dashboard] = await Promise.all([
    getTrainingPuzzle(id),
    getPuzzleDashboard(student.studentId, query)
  ]);
  if (!puzzle) notFound();
  const nextId = nextReplayPuzzleId(dashboard.replayQueue, id);
  const initialPuzzle = preparePublicTrainingPuzzle({
    puzzle, studentId: student.studentId, sessionId: crypto.randomUUID(), selectedTheme: "mixed",
    trainingMode: "legacy", dashboardReplay: true
  });
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Puzzle Replay" subtitle="Turn a tricky position into a pattern you remember."><PuzzleReplay key={id} initialPuzzle={initialPuzzle} backHref={dashboardHref(query)} nextHref={nextId ? puzzleReplayHref(nextId, query) : null} initialAutoAdvance={search.auto === "1"} /></StudentPortalShell>;
}
