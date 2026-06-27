import { AppShell } from "@/components/AppShell";
import { PortalBoard } from "@/components/PortalBoard";

export default function PortalPage() {
  return (
    <AppShell title="Students" subtitle="Welcome to the Chess Academy Quest Board.">
      <PortalBoard />
    </AppShell>
  );
}
