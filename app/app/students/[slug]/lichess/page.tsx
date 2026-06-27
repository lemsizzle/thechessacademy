import { AppShell } from "@/components/AppShell";
import { StudentLichessDetails } from "@/components/lichess/StudentLichessDetails";

export default async function StudentLichessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <AppShell title="Student Lichess" subtitle="Blitz, Rapid, and Puzzle rating summary, plus teacher-reviewed game submissions.">
      <StudentLichessDetails slug={slug} />
    </AppShell>
  );
}
