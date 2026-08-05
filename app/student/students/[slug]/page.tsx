import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { StudentFacingProfileLoader } from "@/components/student/StudentFacingProfileLoader";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getStudentBySlug } from "@/lib/data/students";

export const dynamic = "force-dynamic";

export default async function StudentFacingProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const student = await getStudentBySlug(slug);
  const avatarDisplay = student
    ? await getStudentAvatarDisplayData([student.id])
    : { items: [], avatars: {} };

  return (
    <StudentPortalShell title="Student Profile" subtitle="Student-facing progress page.">
      <StudentFacingProfileLoader
        slug={slug}
        initialStudent={student}
        avatarItems={avatarDisplay.items}
        studentAvatar={student ? avatarDisplay.avatars[student.id] : undefined}
      />
    </StudentPortalShell>
  );
}
