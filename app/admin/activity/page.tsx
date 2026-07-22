import { AdminRosterActivityFeed } from "@/components/admin/AdminRosterActivityFeed";
import { AppShell } from "@/components/AppShell";
import { getAdminRosterActivity } from "@/lib/activity/adminRosterActivity";

export default async function AdminActivityPage() {
  const activity = await getAdminRosterActivity();
  return (
    <AppShell title="Student Activity" subtitle="Review recent progress and actions across the full roster." variant="admin">
      <AdminRosterActivityFeed items={activity} />
    </AppShell>
  );
}
