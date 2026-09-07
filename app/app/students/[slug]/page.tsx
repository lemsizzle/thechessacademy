import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PublicStudentProfileGate } from "@/components/PublicStudentProfileGate";
import { StudentJourneyDashboard } from "@/components/student/StudentJourneyDashboard";
import { getPublicStudentDashboard } from "@/lib/student/publicDashboard";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dashboard = await getPublicStudentDashboard(slug);
  if (!dashboard) notFound();
  return (
    <AppShell title={`${dashboard.student.name}'s Academy Journey`} subtitle="Student profile · Read-only">
      <PublicStudentProfileGate key={slug} slug={slug}>
        <StudentJourneyDashboard data={dashboard} readOnly />
      </PublicStudentProfileGate>
    </AppShell>
  );
}
