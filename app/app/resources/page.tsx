import { AppShell } from "@/components/AppShell";
import { ResourcesBoard } from "@/components/ResourcesBoard";

export default function ResourcesPage() {
  return (
    <AppShell title="Resources FAQ" subtitle="How to use the Quest Board, gain XP, and find helpful chess practice links.">
      <ResourcesBoard />
    </AppShell>
  );
}
