import { QuestBoard } from "@/components/QuestBoard";
import { StudentLichessQuestList } from "@/components/quests/StudentLichessQuestList";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentQuestsPage() {
  return (
    <StudentPortalShell title="Quests" subtitle="Live academy challenges and completed quest victories.">
      <div className="space-y-6">
        <StudentLichessQuestList />
        <QuestBoard excludeLichess />
      </div>
    </StudentPortalShell>
  );
}
