import { LiveGameSpectator } from "@/chess/components/LiveGameSpectator";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export const dynamic = "force-dynamic";

export default async function StudentArenaSpectatorPage({ params }: { params: Promise<{ tournamentId: string; gameId: string }> }) {
  const { tournamentId, gameId } = await params;
  return (
    <StudentPortalShell title="Watch Arena Game" subtitle="Follow the live board without affecting either player.">
      <LiveGameSpectator gameId={gameId} role="student" tournamentId={tournamentId} />
    </StudentPortalShell>
  );
}
