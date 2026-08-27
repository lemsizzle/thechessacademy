import { AppShell } from "@/components/AppShell";
import { InternalArenaLobby } from "@/components/tournaments/InternalArenaLobby";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

export default async function AdminArenaLobbyPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const [{ tournamentId }, adminActionToken] = await Promise.all([params, createAdminActionToken()]);
  return (
    <AppShell title="Arena Lobby" subtitle="Monitor the event, chat with students, watch games, and control pairings." variant="admin">
      <InternalArenaLobby tournamentId={tournamentId} role="teacher" adminActionToken={adminActionToken} />
    </AppShell>
  );
}
