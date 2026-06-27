import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";

export default function AdminQuestsPage() {
  return (
    <AppShell title="Manage Quests" variant="admin">
      <div className="mb-5 flex flex-wrap gap-2">
        <Button href="/admin/lichess/quest-awards" variant="secondary">Quest Award Queue</Button>
      </div>
      <AdminPanel mode="quests" />
    </AppShell>
  );
}
