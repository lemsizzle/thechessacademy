import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { BadgeList } from "@/components/BadgeList";
import { getBadgesResult } from "@/lib/data/badges";

export const dynamic = "force-dynamic";

export default async function StudentBadgesPage() {
  await requireStudentPage();
  const badges = await getBadgesResult();
  return <StudentPortalShell title="Badges" subtitle="Find out how to earn every badge. Select a name to see its artwork.">
    {badges.source === "mock" && <p role="status" className="mb-4 text-sm text-amber-200">Showing the sample catalog. The full badge catalog is temporarily unavailable; please try again later.</p>}
    <BadgeList badges={badges.data} />
  </StudentPortalShell>;
}
