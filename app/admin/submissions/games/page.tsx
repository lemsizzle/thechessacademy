import { AppShell } from "@/components/AppShell";
import { AdminGameSubmissionsTable } from "@/components/admin/AdminGameSubmissionsTable";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export default async function AdminGameSubmissionsPage() {
  const adminActionToken = await createAdminActionToken();
  return (
    <AppShell title="Game Submissions" subtitle="Review previously submitted games and send feedback. New Chess Quest games are available from each student’s profile." variant="admin">
      <AdminGameSubmissionsTable adminActionToken={adminActionToken} />
    </AppShell>
  );
}
