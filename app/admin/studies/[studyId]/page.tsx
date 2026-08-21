import { StudyEditor } from "@/chess/components/StudyEditor";
import { AppShell } from "@/components/AppShell";

export default async function AdminStudyPage({ params, searchParams }: { params: Promise<{ studyId: string }>; searchParams: Promise<{ chapter?: string | string[] }> }) {
  const [{ studyId }, { chapter }] = await Promise.all([params, searchParams]);
  return <AppShell title="Study Workspace" subtitle="Prepare reusable teaching lines and annotated positions." variant="admin"><StudyEditor studyId={studyId} basePath="/admin" initialChapterId={typeof chapter === "string" ? chapter : undefined} /></AppShell>;
}
