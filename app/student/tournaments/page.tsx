import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { TournamentsBoard } from "@/components/tournaments/TournamentsBoard";
import { StudentInternalArenas } from "@/components/tournaments/StudentInternalArenas";

export default function StudentTournamentsPage() {
  return (
    <StudentPortalShell title="Arena Tournaments" subtitle="Play internal Academy Arenas or join external Lichess events.">
      <div className="space-y-8">
        <StudentInternalArenas />
        <div className="border-t border-white/10 pt-8"><TournamentsBoard studentView /></div>
      </div>
    </StudentPortalShell>
  );
}
