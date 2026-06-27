import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { TournamentsBoard } from "@/components/tournaments/TournamentsBoard";

export default function StudentTournamentsPage() {
  return (
    <StudentPortalShell title="Upcoming Tournaments" subtitle="Join academy tournaments on Lichess without leaving your student portal.">
      <TournamentsBoard studentView />
    </StudentPortalShell>
  );
}
