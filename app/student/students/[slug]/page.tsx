import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { StudentFacingProfileLoader } from "@/components/student/StudentFacingProfileLoader";

export default async function StudentFacingProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <StudentPortalShell title="Student Profile" subtitle="Student-facing progress page.">
      <StudentFacingProfileLoader slug={slug} />
    </StudentPortalShell>
  );
}
