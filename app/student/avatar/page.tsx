import { AvatarStudio } from "@/components/student/AvatarStudio";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentAvatarStudioPage() {
  return (
    <StudentPortalShell title="Avatar Studio" subtitle="Build your academy avatar from owned cosmetic layers.">
      <AvatarStudio />
    </StudentPortalShell>
  );
}
