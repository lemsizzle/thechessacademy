import { AppShell } from "@/components/AppShell";
import { AdminPanel } from "@/components/admin/AdminPanel";

export default function AdminClassesPage() {
  return (
    <AppShell title="Manage Classes" subtitle="Add, remove, rename, and link class groups." variant="admin">
      <AdminPanel mode="classes" />
    </AppShell>
  );
}
