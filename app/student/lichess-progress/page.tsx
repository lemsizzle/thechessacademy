import { StudentLichessQuestList } from "@/components/quests/StudentLichessQuestList";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentLichessProgressPage() {
  return (
    <StudentPortalShell title="Lichess Progress" subtitle="Daily and weekly activity progress for your linked Lichess quest rules.">
      <StudentLichessQuestList detailed />
    </StudentPortalShell>
  );
}
