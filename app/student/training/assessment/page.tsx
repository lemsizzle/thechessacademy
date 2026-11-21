import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { ChessKnowledgeAssessment } from "@/components/training/ChessKnowledgeAssessment";
import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { sessionToStudentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export default async function AssessmentPage() {
  const student = await requireStudentPage();
  return <StudentPortalShell initialUser={sessionToStudentUser(student)} title="" disableAutomaticLichessSync><ChessKnowledgeAssessment studentId={student.studentId} /></StudentPortalShell>;
}
