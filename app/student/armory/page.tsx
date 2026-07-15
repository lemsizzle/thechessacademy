import { AcademyArmory } from "@/components/student/AcademyArmory";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentAcademyArmoryPage() {
  return (
    <StudentPortalShell title="Academy Armory" subtitle="Spend Academy Coins on chess-themed avatar cosmetics.">
      <AcademyArmory />
    </StudentPortalShell>
  );
}
