import { StudentOnboardingForm } from "@/components/student/StudentOnboardingForm";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default function StudentOnboardingPage() {
  return (
    <StudentPortalShell title="Student Onboarding" subtitle="Confirm your Lichess-linked student profile.">
      <StudentOnboardingForm />
    </StudentPortalShell>
  );
}
