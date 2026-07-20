import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";
import { createAdminActionToken } from "@/lib/auth/adminSession";
import { listAdminQuests } from "@/lib/quests/supabaseQuests";

export default async function AdminQuestsPage() {
  const adminActionToken = await createAdminActionToken();
  let quests;
  try {
    quests = await listAdminQuests();
  } catch {
    quests = undefined;
  }

  return (
    <AppShell title="Manage Quests" variant="admin">
      <AdminPanel mode="quests" initialQuests={quests} adminActionToken={adminActionToken} />
    </AppShell>
  );
}
