import { AppShell } from "@/components/AppShell";
import { AdminGameSubmissionsTable } from "@/components/admin/AdminGameSubmissionsTable";

export default function AdminGameSubmissionsPage() {
  return (
    <AppShell title="Game Submissions" subtitle="Approve, reject, request changes, or send submitted Lichess games to the analyzer." variant="admin">
      <AdminGameSubmissionsTable />
    </AppShell>
  );
}
