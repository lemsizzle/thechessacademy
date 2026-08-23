import { GameAnalysisLoader } from "@/chess/components/GameAnalysisLoader";
import { AppShell } from "@/components/AppShell";

export default async function AdminGameAnalysisPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <AppShell title="Internal Game Analysis" subtitle="Review a completed student game without changing its source record." variant="admin"><GameAnalysisLoader key={gameId} gameId={gameId} basePath="/admin" /></AppShell>;
}
