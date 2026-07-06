import { AppShell } from "@/components/AppShell";
import { AdminGameSubmissionsTable } from "@/components/admin/AdminGameSubmissionsTable";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export default async function AdminGameSubmissionsPage() {
  const adminActionToken = await createAdminActionToken();
  return (
    <AppShell title="Game Submissions" subtitle="Approve, reject, request changes, or send submitted Lichess games to the analyzer." variant="admin">
      <AdminGameSubmissionsTable adminActionToken={adminActionToken} />
    </AppShell>
  );
}
