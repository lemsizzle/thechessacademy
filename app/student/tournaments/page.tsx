import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { StudentInternalArenas } from "@/components/tournaments/StudentInternalArenas";
import { Button } from "@/components/Button";

export default function StudentTournamentsPage() {
  return (
    <StudentPortalShell title="Tournaments" subtitle="Play chess Arenas and Puzzle Battle tournaments with your Chess Quest classmates.">
      <div className="space-y-8">
        <section className="rounded-xl border border-cyan-200/25 bg-slate-950 p-5"><h2 className="text-xl font-black">Puzzle Battle tournaments</h2><p className="my-3 text-slate-300">Join your teacher's puzzle tournament. Play every round, race through shared puzzles, and climb the standings.</p><Button href="/student/tournaments/puzzle">Puzzle tournaments</Button></section>
        <StudentInternalArenas />
      </div>
    </StudentPortalShell>
  );
}
