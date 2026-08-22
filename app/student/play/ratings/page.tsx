import { ChessRatingDashboard } from "@/chess/components/ChessRatingDashboard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentChessRatingsPage() {
  return <StudentPortalShell title="Academy Chess Ratings" subtitle="Track your internal PvP rating, rated-game history, and leaderboard position."><ChessRatingDashboard /></StudentPortalShell>;
}
