import { GameAnalysisLoader } from "@/chess/components/GameAnalysisLoader";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function StudentGameAnalysisPage({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ ply?: string }> }) {
  const { gameId } = await params;
  const ply = Number((await searchParams).ply ?? 0);
  const initialPly = Number.isSafeInteger(ply) && ply >= 0 && ply <= 1000 ? ply : 0;
  return <StudentPortalShell title="Analysis Board" subtitle="Replay your game, try different moves, and review key moments."><GameAnalysisLoader key={gameId} gameId={gameId} basePath="/student" initialPly={initialPly} /></StudentPortalShell>;
}
