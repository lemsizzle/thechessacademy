import { AppShell } from "@/components/AppShell";
import { StudentProfileBoard } from "@/components/StudentProfileBoard";
import { students } from "@/data/students";

export function generateStaticParams() {
  return students.map((student) => ({ slug: student.slug }));
}

export default async function StudentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <AppShell title="Student Quest Log" subtitle="Progress page for students and parents.">
      <StudentProfileBoard slug={slug} />
    </AppShell>
  );
}
