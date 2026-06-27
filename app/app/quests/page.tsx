import { AppShell } from "@/components/AppShell";
import { QuestBoard } from "@/components/QuestBoard";

export default function QuestsPage() {
  return (
    <AppShell title="Quests" subtitle="Live academy challenges and completed quest victories.">
      <QuestBoard />
    </AppShell>
  );
}
