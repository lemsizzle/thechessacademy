import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { EndgameTraining } from "@/components/training/EndgameTraining";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EndgameTrainingPage() {
  const student = await requireStudentPage();
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="" disableAutomaticLichessSync>
    <EndgameTraining studentId={student.studentId} />
  </StudentPortalShell>;
}
