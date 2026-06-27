import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";

export default function AdminActivityPage() {
  return <AppShell title="Activity" variant="admin"><AdminPanel mode="activity" /></AppShell>;
}
