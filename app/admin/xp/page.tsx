import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export default async function AdminXpPage() {
  const adminActionToken = await createAdminActionToken();
  return <AppShell title="Manage XP" variant="admin"><AdminPanel mode="xp" adminActionToken={adminActionToken} /></AppShell>;
}
