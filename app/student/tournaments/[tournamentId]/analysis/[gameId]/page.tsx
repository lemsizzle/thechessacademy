import { ArenaGameAnalysis } from "@/chess/components/ArenaGameAnalysis";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function ArenaAnalysisPage({ params }: { params: Promise<{ tournamentId: string; gameId: string }> }) {
  const { tournamentId, gameId } = await params;
  return <StudentPortalShell title="Tournament Game Analysis" subtitle="Replay the game and explore your own variations."><ArenaGameAnalysis tournamentId={tournamentId} gameId={gameId} role="student" /></StudentPortalShell>;
}
