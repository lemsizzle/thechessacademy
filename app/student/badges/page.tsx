import { BadgeGallery } from "@/components/BadgeGallery";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { getBadgesResult } from "@/lib/data/badges";

export default async function StudentBadgesPage() {
  const badges = await getBadgesResult();

  return (
    <StudentPortalShell title="Badge Gallery" subtitle="Browse tactic ladders and concept mastery badges.">
      <BadgeGallery badges={badges.data} />
    </StudentPortalShell>
  );
}
