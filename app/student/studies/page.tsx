import { StudyLibrary } from "@/chess/components/StudyLibrary";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentStudiesPage() {
  return <StudentPortalShell title="Chess Studies" subtitle="Review completed games and build a persistent chess notebook."><StudyLibrary basePath="/student" /></StudentPortalShell>;
}
