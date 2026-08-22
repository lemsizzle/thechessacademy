import { AdminAdaptiveTraining } from "@/chess/components/AdminAdaptiveTraining";
import { getAdminAdaptiveReviewReport } from "@/chess/training/adaptiveReviewServer";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";

export const dynamic = "force-dynamic";

export default async function AdminAdaptiveTrainingPage() {
  try {
    const students = await getAdminAdaptiveReviewReport();
    return <AppShell title="Adaptive Training" subtitle="See which game mistakes students are reviewing and which ideas they have mastered." variant="admin"><AdminAdaptiveTraining students={students} /></AppShell>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adaptive training progress could not be loaded.";
    return <AppShell title="Adaptive Training" subtitle="See which game mistakes students are reviewing and which ideas they have mastered." variant="admin"><Card className="p-6 text-sm font-bold text-rose-100">{message}</Card></AppShell>;
  }
}
