import { GameAnalysisLoader } from "@/chess/components/GameAnalysisLoader";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function StudentGameAnalysisPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <StudentPortalShell title="Game Analysis" subtitle="Replay the original game, investigate alternatives, and save your work to a study."><GameAnalysisLoader gameId={gameId} basePath="/student" /></StudentPortalShell>;
}
