import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";
import { createAdminActionToken } from "@/lib/auth/adminSession";
import { listAdminBadges } from "@/lib/badges/supabaseBadges";
import { listSupabaseStudents } from "@/lib/students/supabaseStudentProfiles";
import { deleteAdminStudent } from "./actions";

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { student } = await searchParams;
  const [supabaseStudents, badges] = await Promise.all([
    listSupabaseStudents(),
    listAdminBadges().catch(() => undefined)
  ]);
  const adminActionToken = await createAdminActionToken();

  return (
    <AppShell title="Manage Students" variant="admin">
      <AdminPanel
        mode="students"
        requestedStudent={student}
        initialStudents={supabaseStudents.configured ? supabaseStudents.students : undefined}
        initialBadges={badges}
        deleteStudentAction={deleteAdminStudent}
        adminActionToken={adminActionToken}
      />
    </AppShell>
  );
}
