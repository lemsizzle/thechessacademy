import { AppShell } from "@/components/AppShell";
import { DevDataSourceNote } from "@/components/DevDataSourceNote";
import { QuestBoard } from "@/components/QuestBoard";
import { getBadgesResult } from "@/lib/data/badges";
import { getQuestsResult } from "@/lib/data/quests";

export const dynamic = "force-dynamic";

export default async function QuestsPage() {
  const [quests, badges] = await Promise.all([
    getQuestsResult(),
    getBadgesResult()
  ]);

  return (
    <AppShell title="Quests" subtitle="Live academy challenges and completed quest victories.">
      <DevDataSourceNote show={quests.source === "mock" || badges.source === "mock"} />
      <QuestBoard initialQuests={quests.data} badges={badges.data} />
    </AppShell>
  );
}
