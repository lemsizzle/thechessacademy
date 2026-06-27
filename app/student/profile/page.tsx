import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { StudentProfilePrivateLoader } from "@/components/student/StudentProfilePrivateLoader";

export default function StudentPrivateProfilePage() {
  return (
    <StudentPortalShell title="My Profile" subtitle="Your private profile view.">
      <StudentProfilePrivateLoader />
    </StudentPortalShell>
  );
}
