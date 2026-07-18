import { AvatarStudio } from "@/components/student/AvatarStudio";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentAvatarStudioPage() {
  return (
    <StudentPortalShell title="Avatar Studio & Store" subtitle="Build your academy look with earned and purchased cosmetics.">
      <AvatarStudio />
    </StudentPortalShell>
  );
}
