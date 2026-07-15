import { AppShell } from "@/components/AppShell";
import { AdminAvatarItemsPanel } from "@/components/admin/AdminAvatarItemsPanel";
import { listSupabaseStudents } from "@/lib/students/supabaseStudentProfiles";

export const dynamic = "force-dynamic";

export default async function AdminAvatarItemsPage() {
  const students = await listSupabaseStudents();
  return (
    <AppShell title="Avatar Items" subtitle="Create cosmetics, grant rewards, and manage Academy Coins." variant="admin">
      <AdminAvatarItemsPanel students={students.students} />
    </AppShell>
  );
}
