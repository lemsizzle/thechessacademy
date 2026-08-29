import { LiveChessGame } from "@/chess/components/LiveChessGame";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { sessionToStudentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CorrespondenceGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const [{ gameId }, session] = await Promise.all([params, requireActiveStudent()]);
  return (
    <StudentPortalShell
      title="Correspondence Game"
      subtitle="You have three days for each move. The board safely reconnects whenever you return."
      initialUser={sessionToStudentUser(session)}
    >
      <LiveChessGame key={gameId} gameId={gameId} mode="correspondence" />
    </StudentPortalShell>
  );
}
