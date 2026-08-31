import { VsComputerGame } from "@/chess/components/VsComputerGame";
import { PlayModeGrid } from "@/chess/components/PlayModeGrid";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getStudentBotProgression } from "@/chess/persistence/botProgressionServer";

export const dynamic = "force-dynamic";

export default async function StudentPlayPage() {
  const student = await requireActiveStudent();
  const [avatarDisplay, botProgression] = await Promise.all([
    getStudentAvatarDisplayData([student.studentId]),
    getStudentBotProgression(student.studentId)
  ]);
  const studentAvatar = avatarDisplay.avatars[student.studentId];
  const equippedItemIds = new Set(Object.values(studentAvatar.equippedItems));
  const equippedAvatarItems = avatarDisplay.items.filter((item) => equippedItemIds.has(item.id));

  return (
    <StudentPortalShell title="Play Chess" subtitle="Choose a mode and start playing.">
      <div className="space-y-5">
        <PlayModeGrid />
        <section id="computer-game" className="scroll-mt-5" aria-labelledby="computer-game-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="computer-game-title" className="text-lg font-black text-white">Computer game</h2>
            <span className="text-xs font-bold text-slate-500">No pressure · instant play</span>
          </div>
          <VsComputerGame studentName={student.name} studentAvatar={studentAvatar} avatarItems={equippedAvatarItems} initialUnlockedBotIds={botProgression.unlockedBotIds} />
        </section>
      </div>
    </StudentPortalShell>
  );
}
