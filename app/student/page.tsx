import { PrivateProfileTestResults } from "@/components/training/PrivateProfileTestResults";
import { StudentJourneyDashboard } from "@/components/student/StudentJourneyDashboard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { requireStudentPage as requireActiveStudent } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/student/dashboard";
import { scheduleGameAchievements } from "@/lib/badges/gameAchievements/server";
import { Suspense } from "react";
import { StudentQuickStart } from "@/components/student/StudentQuickStart";

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const session = await requireActiveStudent();
  scheduleGameAchievements([session.studentId]);

  return (
    <StudentPortalShell
      title={`Ready, ${session.name}?`}
      initialUser={sessionToStudentUser(session)}
    >
      <StudentQuickStart />
      <Suspense fallback={<p role="status" className="py-4 text-sm text-slate-400">Loading your progress…</p>}>
        <HomeProgress studentId={session.studentId} />
      </Suspense>
    </StudentPortalShell>
  );
}

async function HomeProgress({ studentId }: { studentId: string }) {
  const dashboard = await getStudentDashboardData(studentId);
  return <StudentJourneyDashboard compact testResults={<PrivateProfileTestResults studentId={studentId} />} data={dashboard} />;
}
