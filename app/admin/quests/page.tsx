import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";

export default function AdminQuestsPage() {
  return (
    <AppShell title="Manage Quests" variant="admin">
      <AdminPanel mode="quests" />
    </AppShell>
  );
}
