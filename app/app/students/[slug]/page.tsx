import { AppShell } from "@/components/AppShell";
import { DevDataSourceNote } from "@/components/DevDataSourceNote";
import { StudentProfileBoard } from "@/components/StudentProfileBoard";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getBadgesResult } from "@/lib/data/badges";
import { getQuestsResult } from "@/lib/data/quests";
import { getStudentBySlug } from "@/lib/data/students";
import { getXpEventsResult } from "@/lib/data/xpEvents";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studentPromise = getStudentBySlug(slug);
  const [student, badges, xpEvents, quests] = await Promise.all([
    studentPromise,
    getBadgesResult(),
    getXpEventsResult(),
    getQuestsResult()
  ]);
  const avatarDisplay = student
    ? await getStudentAvatarDisplayData([student.id])
    : { items: [], avatars: {} };

  return (
    <AppShell title="Student Quest Log" subtitle="Progress page for students and parents.">
      <DevDataSourceNote show={badges.source === "mock" || xpEvents.source === "mock" || quests.source === "mock"} />
      <StudentProfileBoard
        slug={slug}
        initialStudent={student}
        badges={badges.data}
        xpEvents={xpEvents.data}
        quests={quests.data}
        avatarItems={avatarDisplay.items}
        studentAvatar={student ? avatarDisplay.avatars[student.id] : undefined}
      />
    </AppShell>
  );
}
