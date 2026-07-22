import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AppShell } from "@/components/AppShell";
import { getAdminRosterActivity } from "@/lib/activity/adminRosterActivity";

export default async function AdminPage() {
  const activity = await getAdminRosterActivity(40);
  return (
    <AppShell title="Teacher Dashboard" subtitle="Choose an admin section to edit, or review recent activity." variant="admin">
      <AdminDashboard activity={activity} />
    </AppShell>
  );
}
