import { Suspense } from "react";
import Link from "next/link";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { PuzzleDashboard } from "@/components/training/PuzzleDashboard";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";
import { parseDashboardQuery, type DashboardQuery } from "@/lib/puzzle-training/dashboard";
import { getPuzzleDashboard } from "@/lib/puzzle-training/dashboardServer";

export const dynamic = "force-dynamic";

export default async function PuzzleDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const student = await requireStudentPage();
  const query = parseDashboardQuery(await searchParams);
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Puzzle Dashboard" subtitle="Your ChessQuest puzzle progress, one pattern at a time.">
    <Suspense key={JSON.stringify(query)} fallback={<p role="status" className="p-6 text-cyan-100">Gathering your puzzle progress…</p>}><DashboardContent studentId={student.studentId} query={query} /></Suspense>
  </StudentPortalShell>;
}

async function DashboardContent({ studentId, query }: { studentId: string; query: DashboardQuery }) {
  try {
    return <PuzzleDashboard data={await getPuzzleDashboard(studentId, query)} />;
  } catch {
    return <div role="alert" className="rounded-xl border border-rose-200/30 bg-slate-950 p-6"><h2 className="text-xl font-bold text-white">Your progress couldn’t load</h2><p className="mt-2 text-slate-300">Nothing has been lost. Refresh this page to try again, or head back to training.</p><Link href="/student/training" className="mt-4 inline-block text-cyan-200 underline">Back to training</Link></div>;
  }
}
