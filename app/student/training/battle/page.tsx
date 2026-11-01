import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";
import { PuzzleBattle } from "@/components/training/PuzzleBattle";
export const dynamic = "force-dynamic";
export default async function PuzzleBattlePage() {
  const student = await requireStudentPage();
  return (
    <StudentPortalShell
      initialUser={sessionToStudentUser(student)}
      disableAutomaticLichessSync
      title=""
    >
      <PuzzleBattle />
    </StudentPortalShell>
  );
}
