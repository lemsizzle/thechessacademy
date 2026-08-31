import { GameAnalysisLoader } from "@/chess/components/GameAnalysisLoader";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function StudentGameAnalysisPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <StudentPortalShell title="Game Review" subtitle="Start with three key moments, then explore deeper if you want."><GameAnalysisLoader key={gameId} gameId={gameId} basePath="/student" /></StudentPortalShell>;
}
