import { AppShell } from "@/components/AppShell";
import { DevDataSourceNote } from "@/components/DevDataSourceNote";
import { StudentProfileBoard } from "@/components/StudentProfileBoard";
import { getBadgesResult } from "@/lib/data/badges";
import { getQuestsResult } from "@/lib/data/quests";
import { getStudentBySlug } from "@/lib/data/students";
import { getXpEventsResult } from "@/lib/data/xpEvents";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [student, badges, xpEvents, quests] = await Promise.all([
    getStudentBySlug(slug),
    getBadgesResult(),
    getXpEventsResult(),
    getQuestsResult()
  ]);

  return (
    <AppShell title="Student Quest Log" subtitle="Progress page for students and parents.">
      <DevDataSourceNote show={badges.source === "mock" || xpEvents.source === "mock" || quests.source === "mock"} />
      <StudentProfileBoard slug={slug} initialStudent={student} badges={badges.data} xpEvents={xpEvents.data} quests={quests.data} />
    </AppShell>
  );
}
