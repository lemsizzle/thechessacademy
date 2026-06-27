import { ResourcesBoard } from "@/components/ResourcesBoard";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentResourcesPage() {
  return (
    <StudentPortalShell title="Resources FAQ" subtitle="How to use the Quest Board, gain XP, and find helpful chess practice links.">
      <ResourcesBoard />
    </StudentPortalShell>
  );
}
