import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";
import { listSupabaseStudents } from "@/lib/students/supabaseStudentProfiles";
import { deleteAdminStudent } from "./actions";

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { student } = await searchParams;
  const supabaseStudents = await listSupabaseStudents();

  return (
    <AppShell title="Manage Students" variant="admin">
      <AdminPanel
        mode="students"
        requestedStudent={student}
        initialStudents={supabaseStudents.configured ? supabaseStudents.students : undefined}
        deleteStudentAction={deleteAdminStudent}
      />
    </AppShell>
  );
}
