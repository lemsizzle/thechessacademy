import { LiveGameSpectator } from "@/chess/components/LiveGameSpectator";
import { AppShell } from "@/components/AppShell";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

export default async function AdminWatchLiveGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return (
    <AppShell title="Watch Live Game" subtitle="Read-only teacher view with live moves and clocks." variant="admin">
      <LiveGameSpectator key={gameId} gameId={gameId} adminActionToken={await createAdminActionToken()} />
    </AppShell>
  );
}
