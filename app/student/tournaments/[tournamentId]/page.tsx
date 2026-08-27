import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { InternalArenaLobby } from "@/components/tournaments/InternalArenaLobby";

export const dynamic = "force-dynamic";

export default async function StudentArenaLobbyPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  return (
    <StudentPortalShell title="Arena Lobby" subtitle="Follow the standings, queue, pairings, and tournament chat in one place.">
      <InternalArenaLobby tournamentId={tournamentId} role="student" />
    </StudentPortalShell>
  );
}
