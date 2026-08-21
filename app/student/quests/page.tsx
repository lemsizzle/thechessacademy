import { QuestBoard } from "@/components/QuestBoard";
import { StudentLichessQuestList } from "@/components/quests/StudentLichessQuestList";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentQuestsPage() {
  return (
    <StudentPortalShell title="Quests & Activity Progress" subtitle="Start quests, refresh Academy and Lichess activity, and track completed challenges from one place.">
      <div className="space-y-6">
        <StudentLichessQuestList />
        <QuestBoard excludeAutomated />
      </div>
    </StudentPortalShell>
  );
}
