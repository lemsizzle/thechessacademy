import { LiveGameLobby } from "@/chess/components/LiveGameLobby";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentLiveGamesPage() {
  return (
    <StudentPortalShell title="Live Games" subtitle="Match, challenge, or join.">
      <LiveGameLobby />
    </StudentPortalShell>
  );
}
