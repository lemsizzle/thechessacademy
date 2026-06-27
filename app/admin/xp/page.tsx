import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";

export default function AdminXpPage() {
  return <AppShell title="Manage XP" variant="admin"><AdminPanel mode="xp" /></AppShell>;
}
