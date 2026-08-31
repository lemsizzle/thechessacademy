import { ChessHistoryDashboard } from "@/chess/components/ChessHistoryDashboard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentChessHistoryPage() {
  return (
    <StudentPortalShell
      title="Game History"
      subtitle="Replay and analyze completed games."
    >
      <ChessHistoryDashboard />
    </StudentPortalShell>
  );
}
