import { QuestBoard } from "@/components/QuestBoard";
import { StudentLichessQuestList } from "@/components/quests/StudentLichessQuestList";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentQuestsPage() {
  return (
    <StudentPortalShell title="Quests & Lichess Progress" subtitle="Start quests, sync Lichess activity, and track completed academy challenges from one place.">
      <div className="space-y-6">
        <StudentLichessQuestList />
        <QuestBoard excludeLichess />
      </div>
    </StudentPortalShell>
  );
}
