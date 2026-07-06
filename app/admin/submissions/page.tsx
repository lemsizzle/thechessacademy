import { AppShell } from "@/components/AppShell";
import { AdminSubmissionsDashboard } from "@/components/admin/AdminSubmissionsDashboard";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export default async function AdminSubmissionsPage() {
  const adminActionToken = await createAdminActionToken();
  return (
    <AppShell title="Student Submissions" subtitle="Review student games and puzzle challenge scores before anything counts." variant="admin">
      <AdminSubmissionsDashboard adminActionToken={adminActionToken} />
    </AppShell>
  );
}
