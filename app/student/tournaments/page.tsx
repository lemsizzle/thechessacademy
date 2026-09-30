import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { StudentInternalArenas } from "@/components/tournaments/StudentInternalArenas";

export default function StudentTournamentsPage() {
  return (
    <StudentPortalShell title="Arena Tournaments" subtitle="Play Arena tournaments with your Chess Quest classmates.">
      <div className="space-y-8">
        <StudentInternalArenas />
      </div>
    </StudentPortalShell>
  );
}
