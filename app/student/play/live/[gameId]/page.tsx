import { LiveChessGame } from "@/chess/components/LiveChessGame";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function StudentLiveGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return (
    <StudentPortalShell title="Live Game" subtitle="Your board reconnects automatically if the page reloads or the network briefly drops.">
      <LiveChessGame gameId={gameId} />
    </StudentPortalShell>
  );
}
