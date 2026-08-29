import { VsComputerGame } from "@/chess/components/VsComputerGame";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
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
    <StudentPortalShell title="Play Chess" subtitle="Play live, take your time in correspondence, or challenge an Academy computer opponent.">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:flex-col lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Student vs student</p>
              <h2 className="mt-1 text-2xl font-black text-white">Play a classmate live</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Create a private challenge, share the code, and play with real-time moves, clocks, draw offers, and reconnect support.</p>
            </div>
            <Button href="/student/play/live" className="shrink-0">Open Live Games</Button>
          </Card>
          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-violet-200">Play over a few days</p>
              <h2 className="mt-1 text-2xl font-black text-white">Correspondence games</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Challenge another student from the leaderboard, then take up to three days to plan each move.</p>
            </div>
            <Button href="/student/play/correspondence" variant="secondary" className="mt-auto shrink-0">Open Correspondence</Button>
          </Card>
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:flex-col lg:items-start">
            <div><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Keep learning</p><h2 className="mt-1 text-2xl font-black text-white">Play without pressure</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Every game is practice. Focus on thoughtful moves, try new ideas, and use the analysis board to learn from the result.</p></div>
            <Button href="/student/play/live" variant="secondary" className="shrink-0">Find a Game</Button>
          </Card>
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:flex-col lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-200">Progress</p>
              <h2 className="mt-1 text-2xl font-black text-white">Review your game history</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">See your win, draw, and loss record across computer and live games, then open any result in the analysis board.</p>
            </div>
            <Button href="/student/play/history" variant="secondary" className="shrink-0">View Game History</Button>
          </Card>
        </div>
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Play the computer</p>
          <VsComputerGame studentName={student.name} studentAvatar={studentAvatar} avatarItems={equippedAvatarItems} initialUnlockedBotIds={botProgression.unlockedBotIds} />
        </div>
      </div>
    </StudentPortalShell>
  );
}
