import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { SubmitWorkHub } from "@/components/student/SubmitWorkHub";

export default function StudentSubmitPage() {
  return (
    <StudentPortalShell title="Submit Work" subtitle="Send games and puzzle scores to your teacher, then track every submission here.">
      <SubmitWorkHub />
    </StudentPortalShell>
  );
}
