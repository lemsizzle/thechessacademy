import { StudentLichessDetails } from "@/components/lichess/StudentLichessDetails";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function StudentFacingLichessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <StudentPortalShell title="Student Lichess" subtitle="Ratings, puzzle progress, and submitted games without leaving the student portal.">
      <StudentLichessDetails slug={slug} profileBasePath="/student/students" />
    </StudentPortalShell>
  );
}
