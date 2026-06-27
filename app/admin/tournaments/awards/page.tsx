import { AppShell } from "@/components/AppShell";
import { AdminTournamentAwardsTable } from "@/components/tournaments/AdminTournamentAwardsTable";

export default function AdminTournamentAwardsPage() {
  return (
    <AppShell title="Arena Tournament XP Awards" subtitle="Approve or reject calculated Arena XP before it reaches student totals." variant="admin">
      <AdminTournamentAwardsTable />
    </AppShell>
  );
}
