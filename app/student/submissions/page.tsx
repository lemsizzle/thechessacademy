import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { StudentSubmissionsTable } from "@/components/student/StudentSubmissionsTable";

export default function StudentSubmissionsPage() {
  return (
    <StudentPortalShell title="My Submissions" subtitle="Track pending, approved, rejected, and needs-changes submissions.">
      <StudentSubmissionsTable />
    </StudentPortalShell>
  );
}
