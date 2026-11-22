import { VsComputerGame } from "@/chess/components/VsComputerGame";
import { PlayModeGrid } from "@/chess/components/PlayModeGrid";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { requireStudentPage as requireActiveStudent } from "@/lib/auth/requireStudentPage";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getStudentBotProgression } from "@/chess/persistence/botProgressionServer";
import { sessionToStudentUser } from "@/lib/auth/session";
import { getOwnDisplayedBadge } from "@/lib/badges/displayedBadgeServer";
import { getStudentSeasonalReductions } from "@/chess/persistence/seasonalAdaptationServer";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function StudentPlayPage() {
  const student = await requireActiveStudent();
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Play">
    <div className="space-y-4">
      <PlayModeGrid />
      <section id="computer-game" className="scroll-mt-20" aria-label="Computer game">
        <Suspense fallback={<p role="status" className="py-5 text-slate-300">Getting your opponents ready…</p>}><ComputerContent student={student} /></Suspense>
      </section>
    </div>
  </StudentPortalShell>;
}

async function ComputerContent({ student }: { student: Awaited<ReturnType<typeof requireActiveStudent>> }) {
  const [avatarDisplay, botProgression, displayedBadge, seasonalReductions] = await Promise.all([
    getStudentAvatarDisplayData([student.studentId]),
    getStudentBotProgression(student.studentId),
    getOwnDisplayedBadge(student.studentId).catch(() => null),
    getStudentSeasonalReductions(student.studentId).catch(() => null)
  ]);
  const studentAvatar = avatarDisplay.avatars[student.studentId];
  const equippedItemIds = new Set(Object.values(studentAvatar.equippedItems));
  const equippedAvatarItems = avatarDisplay.items.filter((item) => equippedItemIds.has(item.id));

  return <VsComputerGame studentName={student.name} studentAvatar={studentAvatar} displayedBadge={displayedBadge} avatarItems={equippedAvatarItems} initialUnlockedBotIds={botProgression.unlockedBotIds} initialSeasonalReductions={seasonalReductions} />;
}
