import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";
import { createAdminActionToken } from "@/lib/auth/adminSession";
import { listAvatarItems } from "@/lib/avatar/supabaseAvatar";
import { listAdminBadges } from "@/lib/badges/supabaseBadges";
import { listSupabaseStudents } from "@/lib/students/supabaseStudentProfiles";
import { deleteAdminStudent } from "./actions";

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { student } = await searchParams;
  const [supabaseStudents, badges, avatarItems] = await Promise.all([
    listSupabaseStudents(),
    listAdminBadges().catch(() => undefined),
    listAvatarItems({ includeInactive: true, useService: true })
  ]);
  const adminActionToken = await createAdminActionToken();

  return (
    <AppShell title="Manage Students" variant="admin">
      <AdminPanel
        mode="students"
        requestedStudent={student}
        initialStudents={supabaseStudents.configured ? supabaseStudents.students : undefined}
        initialBadges={badges}
        initialAvatarItems={avatarItems}
        deleteStudentAction={deleteAdminStudent}
        adminActionToken={adminActionToken}
      />
    </AppShell>
  );
}
