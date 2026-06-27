import { AppShell } from "@/components/AppShell";
import { DevDataSourceNote } from "@/components/DevDataSourceNote";
import { PortalBoard } from "@/components/PortalBoard";
import { getActivityEventsResult } from "@/lib/data/activity";
import { getStudentsResult } from "@/lib/data/students";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const [students, activity] = await Promise.all([
    getStudentsResult(),
    getActivityEventsResult()
  ]);

  return (
    <AppShell title="Students" subtitle="Welcome to the Chess Academy Quest Board.">
      <DevDataSourceNote show={students.source === "mock" || activity.source === "mock"} />
      <PortalBoard initialStudents={students.data} initialActivity={activity.data} />
    </AppShell>
  );
}
