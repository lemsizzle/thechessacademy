import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AppShell } from "@/components/AppShell";

export default function AdminPage() {
  return (
    <AppShell title="Teacher Dashboard" subtitle="Choose an admin section to edit, or review recent activity." variant="admin">
      <AdminDashboard />
    </AppShell>
  );
}
