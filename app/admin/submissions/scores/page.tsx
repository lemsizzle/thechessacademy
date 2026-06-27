import { AppShell } from "@/components/AppShell";
import { AdminScoreSubmissionsTable } from "@/components/admin/AdminScoreSubmissionsTable";

export default function AdminScoreSubmissionsPage() {
  return (
    <AppShell title="Puzzle Score Submissions" subtitle="Approve challenge scores, award XP, and count progress when you choose." variant="admin">
      <AdminScoreSubmissionsTable />
    </AppShell>
  );
}
