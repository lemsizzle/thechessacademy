import { AppShell } from "@/components/AppShell";
import { AdminLichessQuestAwardsTable } from "@/components/quests/AdminLichessQuestAwardsTable";

export default function AdminLichessQuestAwardsPage() {
  return (
    <AppShell title="Lichess Quest Awards" subtitle="Evaluate linked accounts and approve or reject detected quest completions." variant="admin">
      <AdminLichessQuestAwardsTable />
    </AppShell>
  );
}
