import { StudyEditor } from "@/chess/components/StudyEditor";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function StudentStudyPage({ params, searchParams }: { params: Promise<{ studyId: string }>; searchParams: Promise<{ chapter?: string | string[] }> }) {
  const [{ studyId }, { chapter }] = await Promise.all([params, searchParams]);
  return <StudentPortalShell title="Study Workspace" subtitle="Explore lines, annotate positions, and keep your analysis organized."><StudyEditor studyId={studyId} basePath="/student" initialChapterId={typeof chapter === "string" ? chapter : undefined} /></StudentPortalShell>;
}
