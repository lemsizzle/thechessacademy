import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { InternalArenaLobby } from "@/components/tournaments/InternalArenaLobby";

export const dynamic = "force-dynamic";

export default async function StudentArenaLobbyPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  return (
    <StudentPortalShell title="" disableAutomaticLichessSync>
      <InternalArenaLobby tournamentId={tournamentId} role="student" />
    </StudentPortalShell>
  );
}
