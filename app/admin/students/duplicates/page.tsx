import { AppShell } from "@/components/AppShell";
import { AdminDuplicateStudentsTable } from "@/components/admin/AdminDuplicateStudentsTable";

export default function AdminStudentDuplicatesPage() {
  return (
    <AppShell title="Duplicate Student Review" subtitle="Check for accidental duplicate profiles from Lichess onboarding." variant="admin">
      <AdminDuplicateStudentsTable />
    </AppShell>
  );
}
