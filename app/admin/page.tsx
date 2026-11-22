import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AppShell } from "@/components/AppShell";

export default function AdminPage() {
  return (
    <AppShell title="Teacher home" variant="admin">
      <AdminDashboard />
    </AppShell>
  );
}
