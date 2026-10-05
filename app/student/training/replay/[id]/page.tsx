import { notFound } from "next/navigation";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleReplay } from "@/components/training/PuzzleReplay";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";
import { parseDashboardQuery } from "@/lib/puzzle-training/dashboard";
import { hasPuzzleHistory } from "@/lib/puzzle-training/dashboardServer";

export const dynamic = "force-dynamic";

export default async function ReplayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const student = await requireStudentPage();
  const { id } = await params;
  if (!await hasPuzzleHistory(student.studentId, id)) notFound();
  const { period } = parseDashboardQuery(await searchParams);
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Puzzle Replay" subtitle="Turn a tricky position into a pattern you remember."><PuzzleReplay key={id} puzzleId={id} period={period} /></StudentPortalShell>;
}
