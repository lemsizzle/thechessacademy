import { VsComputerGame } from "@/chess/components/VsComputerGame";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function StudentPlayPage() {
  return (
    <StudentPortalShell title="Play Chess" subtitle="Play a classmate live or challenge an academy computer opponent.">
      <div className="space-y-5">
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Student vs student</p>
            <h2 className="mt-1 text-2xl font-black text-white">Play a classmate live</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Create a private challenge, share the code, and play with real-time moves, clocks, draw offers, and reconnect support.</p>
          </div>
          <Button href="/student/play/live" className="shrink-0">Open Live Games</Button>
        </Card>
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Play the computer</p>
          <VsComputerGame />
        </div>
      </div>
    </StudentPortalShell>
  );
}
