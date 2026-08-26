import { AppShell } from "@/components/AppShell";
import { AdminTournamentsPanel } from "@/components/tournaments/AdminTournamentsPanel";
import { AdminInternalArenas } from "@/components/tournaments/AdminInternalArenas";

export default function AdminTournamentsPage() {
  return (
    <AppShell title="Manage Arena Tournaments" subtitle="Host Arena tournaments on Chess Academy or manage external Lichess events." variant="admin">
      <div className="space-y-8">
        <AdminInternalArenas />
        <div className="border-t border-white/10 pt-8"><AdminTournamentsPanel /></div>
      </div>
    </AppShell>
  );
}
