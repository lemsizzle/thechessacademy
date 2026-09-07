import { notFound } from "next/navigation";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { StudentJourneyDashboard } from "@/components/student/StudentJourneyDashboard";
import { getPublicStudentDashboard } from "@/lib/student/publicDashboard";

export const dynamic = "force-dynamic";

export default async function StudentFacingProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dashboard = await getPublicStudentDashboard(slug);
  if (!dashboard) notFound();
  return (
    <StudentPortalShell title={`${dashboard.student.name}'s Academy Journey`} subtitle="Student profile · Read-only">
      <StudentJourneyDashboard data={dashboard} readOnly />
    </StudentPortalShell>
  );
}
