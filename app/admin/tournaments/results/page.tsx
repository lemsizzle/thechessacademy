import { AppShell } from "@/components/AppShell";
import { AdminArenaTournamentResultsTable } from "@/components/tournaments/AdminArenaTournamentResultsTable";

export default function AdminTournamentResultsPage() {
  return (
    <AppShell title="Arena Tournament Results" subtitle="Sync finished Arena standings, match students, and create pending XP awards." variant="admin">
      <AdminArenaTournamentResultsTable />
    </AppShell>
  );
}
