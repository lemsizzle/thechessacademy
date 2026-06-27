import { AppShell } from "@/components/AppShell";
import { AdminTournamentsPanel } from "@/components/tournaments/AdminTournamentsPanel";

export default function AdminTournamentsPage() {
  return (
    <AppShell title="Manage Arena Tournaments" subtitle="Sync Lichess Arena events and add an emergency manual fallback." variant="admin">
      <AdminTournamentsPanel />
    </AppShell>
  );
}
