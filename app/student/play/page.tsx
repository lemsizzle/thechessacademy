import { VsComputerGame } from "@/chess/components/VsComputerGame";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentPlayPage() {
  return (
    <StudentPortalShell title="Play Chess" subtitle="Challenge an academy computer opponent in a complete game of chess.">
      <VsComputerGame />
    </StudentPortalShell>
  );
}
