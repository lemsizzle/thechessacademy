import { AdminLiveGames } from "@/chess/components/AdminLiveGames";
import { listTeacherLiveGames } from "@/chess/persistence/liveGameServer";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

export default async function AdminLiveGamesPage() {
  try {
    const [initialGames, adminActionToken] = await Promise.all([
      listTeacherLiveGames(),
      createAdminActionToken()
    ]);
    return (
      <AppShell title="Live Games" subtitle="Watch student-vs-student games in progress without affecting play." variant="admin">
        <AdminLiveGames initialGames={initialGames} adminActionToken={adminActionToken} />
      </AppShell>
    );
  } catch (error) {
    return <AppShell title="Live Games" subtitle="Watch student-vs-student games in progress without affecting play." variant="admin"><Card className="p-6 text-sm font-bold text-rose-100">{error instanceof Error ? error.message : "Live games could not be loaded."}</Card></AppShell>;
  }
}
