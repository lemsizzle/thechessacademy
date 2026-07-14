import { StudentProfilePrivateLoader } from "@/components/student/StudentProfilePrivateLoader";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentHomePage() {
  return (
    <StudentPortalShell title="My Dashboard" subtitle="Your progress, activity, XP, badges, and Lichess stats in one place.">
      <StudentProfilePrivateLoader />
    </StudentPortalShell>
  );
}
