import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";
import { createAdminActionToken } from "@/lib/auth/adminSession";
import { listAdminBadges } from "@/lib/badges/supabaseBadges";

export default async function AdminBadgesPage() {
  let badges = undefined;
  try {
    badges = await listAdminBadges();
  } catch {
    badges = undefined;
  }
  const adminActionToken = await createAdminActionToken();

  return (
    <AppShell title="Manage Badges" subtitle="Create, edit, delete, and generate badge art from one focused workspace." variant="admin">
      <AdminPanel mode="badges" initialBadges={badges} adminActionToken={adminActionToken} />
    </AppShell>
  );
}
