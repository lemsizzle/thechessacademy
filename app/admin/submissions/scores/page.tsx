import { AppShell } from "@/components/AppShell";
import { AdminScoreSubmissionsTable } from "@/components/admin/AdminScoreSubmissionsTable";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export default async function AdminScoreSubmissionsPage() {
  const adminActionToken = await createAdminActionToken();
  return (
    <AppShell title="Puzzle Score Submissions" subtitle="Approve challenge scores, award XP, and count progress when you choose." variant="admin">
      <AdminScoreSubmissionsTable adminActionToken={adminActionToken} />
    </AppShell>
  );
}
