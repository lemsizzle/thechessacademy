import { ArenaGameAnalysis } from "@/chess/components/ArenaGameAnalysis";
import { AppShell } from "@/components/AppShell";

export default async function ArenaAnalysisPage({ params }: { params: Promise<{ tournamentId: string; gameId: string }> }) {
  const { tournamentId, gameId } = await params;
  return <AppShell title="Tournament Game Analysis" subtitle="Replay the game and explore variations." variant="admin"><ArenaGameAnalysis tournamentId={tournamentId} gameId={gameId} role="teacher" /></AppShell>;
}
