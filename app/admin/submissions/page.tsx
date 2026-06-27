import { AppShell } from "@/components/AppShell";
import { AdminSubmissionsDashboard } from "@/components/admin/AdminSubmissionsDashboard";

export default function AdminSubmissionsPage() {
  return (
    <AppShell title="Student Submissions" subtitle="Review student games and puzzle challenge scores before anything counts." variant="admin">
      <AdminSubmissionsDashboard />
    </AppShell>
  );
}
