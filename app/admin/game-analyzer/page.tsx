import { AppShell } from "@/components/AppShell";
import { GameAnalyzerForm } from "@/components/admin/GameAnalyzerForm";

export default function AdminGameAnalyzerPage() {
  return (
    <AppShell title="Game Analyzer" subtitle="Paste a Lichess game URL, review possible tactics, and approve only what should count." variant="admin">
      <GameAnalyzerForm />
    </AppShell>
  );
}
