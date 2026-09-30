import { AppShell } from "@/components/AppShell";
import { AdminInternalArenas } from "@/components/tournaments/AdminInternalArenas";
import { createAdminActionToken } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const adminActionToken = await createAdminActionToken();

  return (
    <AppShell title="Manage Arena Tournaments" subtitle="Host Arena tournaments on Chess Quest." variant="admin">
      <div className="space-y-8">
        <AdminInternalArenas adminActionToken={adminActionToken} />
      </div>
    </AppShell>
  );
}
