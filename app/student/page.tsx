import { StudentDashboard } from "@/components/student/StudentDashboard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentHomePage() {
  return (
    <StudentPortalShell title="My Dashboard" subtitle="Your private progress and submissions hub.">
      <StudentDashboard />
    </StudentPortalShell>
  );
}
