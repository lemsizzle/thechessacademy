import { ChessHistoryDashboard } from "@/chess/components/ChessHistoryDashboard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentChessHistoryPage() {
  return (
    <StudentPortalShell
      title="Game History"
      subtitle="Track your computer and live games, filter your results, and continue improving in analysis."
    >
      <ChessHistoryDashboard />
    </StudentPortalShell>
  );
}
