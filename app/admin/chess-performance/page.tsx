import { AdminChessPerformance } from "@/chess/components/AdminChessPerformance";
import { getAdminChessPerformance } from "@/chess/persistence/adminPerformanceServer";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";

export const dynamic = "force-dynamic";

export default async function AdminChessPerformancePage({
  searchParams
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { class: requestedClass } = await searchParams;
  try {
    const report = await getAdminChessPerformance(requestedClass);
    return (
      <AppShell
        title="Chess Performance"
        subtitle="Review academy computer and live-game activity across the student roster."
        variant="admin"
      >
        <AdminChessPerformance report={report} />
      </AppShell>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chess performance could not be loaded.";
    return (
      <AppShell title="Chess Performance" subtitle="Review academy computer and live-game activity across the student roster." variant="admin">
        <Card className="p-6 text-sm font-bold text-rose-100">{message}</Card>
      </AppShell>
    );
  }
}
