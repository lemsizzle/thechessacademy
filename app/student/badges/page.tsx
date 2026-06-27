import { BadgeGallery } from "@/components/BadgeGallery";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { badges } from "@/data/badges";

export default function StudentBadgesPage() {
  return (
    <StudentPortalShell title="Badge Gallery" subtitle="Browse tactic ladders and concept mastery badges.">
      <BadgeGallery badges={badges} />
    </StudentPortalShell>
  );
}
