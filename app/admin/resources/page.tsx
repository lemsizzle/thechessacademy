import { AppShell } from "@/components/AppShell";
import { AdminResourcesPanel } from "@/components/admin/AdminResourcesPanel";

export default function AdminResourcesPage() {
  return (
    <AppShell title="Manage Resources" subtitle="Add, edit, archive, delete, and feature public useful links." variant="admin">
      <AdminResourcesPanel />
    </AppShell>
  );
}
