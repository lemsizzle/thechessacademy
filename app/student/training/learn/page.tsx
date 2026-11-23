import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { BeginnerLearn } from "@/components/training/BeginnerLearn";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const student = await requireStudentPage();
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="Learn" disableAutomaticLichessSync>
    <BeginnerLearn studentId={student.studentId} />
  </StudentPortalShell>;
}
