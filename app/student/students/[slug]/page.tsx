import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { StudentFacingProfileLoader } from "@/components/student/StudentFacingProfileLoader";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getStudentBySlug } from "@/lib/data/students";
import { getBadgesResult } from "@/lib/data/badges";

export const dynamic = "force-dynamic";

export default async function StudentFacingProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [student, badges] = await Promise.all([getStudentBySlug(slug), getBadgesResult()]);
  const avatarDisplay = student
    ? await getStudentAvatarDisplayData([student.id])
    : { items: [], avatars: {} };

  return (
    <StudentPortalShell title="Student Profile" subtitle="Student-facing progress page.">
      <StudentFacingProfileLoader
        slug={slug}
        initialStudent={student}
        badges={badges.data}
        avatarItems={avatarDisplay.items}
        studentAvatar={student ? avatarDisplay.avatars[student.id] : undefined}
      />
    </StudentPortalShell>
  );
}
