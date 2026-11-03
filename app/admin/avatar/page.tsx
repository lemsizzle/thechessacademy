import { AppShell } from "@/components/AppShell";
import { AdminAvatarItemsPanel } from "@/components/admin/AdminAvatarItemsPanel";
import { AdminStoreRewards } from "@/components/admin/AdminStoreRewards";
import { createAdminActionToken } from "@/lib/auth/adminSession";
import { listAvatarItems } from "@/lib/avatar/supabaseAvatar";

export const dynamic = "force-dynamic";

export default async function AdminAvatarItemsPage() {
  const [items, adminActionToken] = await Promise.all([
    listAvatarItems({ includeInactive: true, useService: true }),
    createAdminActionToken()
  ]);

  return (
    <AppShell title="Teacher Avatar Studio" subtitle="Create cosmetics, change store prices, and manage store availability." variant="admin">
      <AdminStoreRewards adminActionToken={adminActionToken}/>
      <AdminAvatarItemsPanel initialItems={items} adminActionToken={adminActionToken} />
    </AppShell>
  );
}
