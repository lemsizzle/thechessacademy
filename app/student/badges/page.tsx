import { requireStudentPage } from "@/lib/auth/requireStudentPage";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { BadgeList } from "@/components/BadgeList";
import { getBadgesResult } from "@/lib/data/badges";
import { getOwnDisplayedBadge } from "@/lib/badges/displayedBadgeServer";
import { sessionToStudentUser } from "@/lib/auth/session";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StudentBadgesPage() {
  const student = await requireStudentPage();
  const [badges, displayedBadge] = await Promise.all([getBadgesResult(), getOwnDisplayedBadge(student.studentId).catch(() => null)]);
  return <StudentPortalShell initialUser={{ ...sessionToStudentUser(student), displayedBadge }} title="Badges" subtitle="Find out how to unlock every badge.">
    <p className="mb-5 text-sm text-slate-300">To feature an earned badge, open it in your Trophy Case and click <strong>Feature badge</strong>. <Link href="/student#trophy-case" className="font-bold text-cyan-200 underline">Go to Trophy Case</Link></p>
    {badges.source === "mock" && <p role="status" className="mb-4 text-sm text-amber-200">Showing the sample catalog. The full badge catalog is temporarily unavailable; please try again later.</p>}
    <BadgeList badges={badges.data} />
  </StudentPortalShell>;
}
