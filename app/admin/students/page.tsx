import { AdminPanel } from "@/components/admin/AdminPanel";
import { ManualStudentCreator } from "@/components/admin/ManualStudentCreator";
import { AppShell } from "@/components/AppShell";
import { createAdminActionToken } from "@/lib/auth/adminSession";
import { listAdminBadges } from "@/lib/badges/supabaseBadges";
import { listSupabaseStudents } from "@/lib/students/supabaseStudentProfiles";
import { listStoredLichessAccounts } from "@/lib/lichess/supabaseAccounts";
import { createAdminStudent, deleteAdminStudent } from "./actions";

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { student } = await searchParams;
  const [supabaseStudents, badges] = await Promise.all([
    listSupabaseStudents(),
    listAdminBadges().catch(() => undefined)
  ]);
  const lichessAccounts = supabaseStudents.configured
    ? await listStoredLichessAccounts(supabaseStudents.students.map((item) => item.id))
    : undefined;
  const adminActionToken = await createAdminActionToken();

  return (
    <AppShell title="Manage Students" variant="admin">
      <details className="mb-4 rounded-xl border border-white/10 bg-slate-950/50 px-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-cyan-200">Create Academy login</summary>
        <ManualStudentCreator actionToken={adminActionToken} createStudentAction={createAdminStudent} />
      </details>
      <AdminPanel
        mode="students"
        requestedStudent={student}
        initialStudents={supabaseStudents.configured ? supabaseStudents.students : undefined}
        initialBadges={badges}
        initialStudentLichessAccounts={lichessAccounts}
        deleteStudentAction={deleteAdminStudent}
        adminActionToken={adminActionToken}
      />
    </AppShell>
  );
}
