import { GameAnalysisLoader } from "@/chess/components/GameAnalysisLoader";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function StudentGameAnalysisPage({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ ply?: string }> }) {
  const { gameId } = await params;
  const ply = Number((await searchParams).ply ?? 0);
  const initialPly = Number.isSafeInteger(ply) && ply >= 0 && ply <= 1000 ? ply : 0;
  return <StudentPortalShell title="Game Review" subtitle="Start with three key moments, then explore deeper if you want."><GameAnalysisLoader key={gameId} gameId={gameId} basePath="/student" initialPly={initialPly} /></StudentPortalShell>;
}
