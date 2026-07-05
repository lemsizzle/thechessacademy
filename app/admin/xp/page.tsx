import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";
import { createAdminActionToken } from "@/lib/auth/adminSession";
import { listAdminBadges } from "@/lib/badges/supabaseBadges";
import { listSupabaseStudents } from "@/lib/students/supabaseStudentProfiles";

export default async function AdminXpPage() {
  const [adminActionToken, supabaseStudents, badges] = await Promise.all([
    createAdminActionToken(),
    listSupabaseStudents(),
    listAdminBadges().catch(() => undefined)
  ]);

  return (
    <AppShell title="Manage XP" variant="admin">
      <AdminPanel
        mode="xp"
        adminActionToken={adminActionToken}
        initialStudents={supabaseStudents.configured ? supabaseStudents.students : undefined}
        initialBadges={badges}
      />
    </AppShell>
  );
}
