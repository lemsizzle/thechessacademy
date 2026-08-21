import { LiveGameLobby } from "@/chess/components/LiveGameLobby";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentLiveGamesPage() {
  return (
    <StudentPortalShell title="Live Games" subtitle="Create a private challenge or join a classmate's game.">
      <LiveGameLobby />
    </StudentPortalShell>
  );
}
