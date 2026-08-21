import { StudyLibrary } from "@/chess/components/StudyLibrary";
import { AppShell } from "@/components/AppShell";

export default function AdminStudiesPage() {
  return <AppShell title="Chess Studies" subtitle="Create teaching studies and review internal student games." variant="admin"><StudyLibrary basePath="/admin" /></AppShell>;
}
