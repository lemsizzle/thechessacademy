import { AppShell } from "@/components/AppShell";
import { AdminAvatarItemsPanel } from "@/components/admin/AdminAvatarItemsPanel";
import { listSupabaseStudents } from "@/lib/students/supabaseStudentProfiles";

export const dynamic = "force-dynamic";

export default async function AdminAvatarItemsPage() {
  const students = await listSupabaseStudents();
  return (
    <AppShell title="Teacher Avatar Studio" subtitle="Create cosmetics, change store prices, grant rewards, and manage Academy Coins." variant="admin">
      <AdminAvatarItemsPanel students={students.students} />
    </AppShell>
  );
}
