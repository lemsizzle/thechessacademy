import { StudentJourneyDashboard } from "@/components/student/StudentJourneyDashboard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { sessionToStudentUser } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/student/dashboard";

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const session = await requireActiveStudent();
  const dashboard = await getStudentDashboardData(session.studentId);

  return (
    <StudentPortalShell
      title="My Academy Journey"
      subtitle="Choose where your chess adventure goes next."
      initialUser={sessionToStudentUser(session)}
    >
      <StudentJourneyDashboard data={dashboard} />
    </StudentPortalShell>
  );
}
