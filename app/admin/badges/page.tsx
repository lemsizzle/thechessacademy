import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";

export default function AdminBadgesPage() {
  return <AppShell title="Manage Badges" subtitle="Create badges and test mock AI badge art generation." variant="admin"><AdminPanel mode="badges" /></AppShell>;
}
