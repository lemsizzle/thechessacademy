import { CorrespondenceHub } from "@/components/correspondence/CorrespondenceHub";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { sessionToStudentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CorrespondencePage() {
  const session = await requireActiveStudent();
  return (
    <StudentPortalShell
      title="Correspondence Games"
      subtitle="Three days per move."
      initialUser={sessionToStudentUser(session)}
    >
      <CorrespondenceHub />
    </StudentPortalShell>
  );
}
