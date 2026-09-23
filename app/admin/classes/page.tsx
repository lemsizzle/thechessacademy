import { AppShell } from "@/components/AppShell";
import { AdminClassManager } from "@/components/admin/AdminClassManager";

export default function AdminClassesPage() {
  return (
    <AppShell title="Manage Classes" subtitle="Add, remove, rename, and link class groups." variant="admin">
      <AdminClassManager />
    </AppShell>
  );
}
