"use client";

import { EmptyState } from "@/components/EmptyState";
import { QuestCard } from "@/components/QuestCard";
import { useMockAdminState } from "@/lib/useMockAdminState";

export function QuestBoard({ excludeLichess = false }: { excludeLichess?: boolean }) {
  const { quests } = useMockAdminState();
  const visibleQuests = quests.filter((quest) => (
    (quest.isLive === true || quest.status === "completed")
    && (!excludeLichess || !quest.source?.startsWith("lichess_"))
  ));

  if (!visibleQuests.length) {
    return <EmptyState title="No live quests yet" message="Check back soon for the next academy challenge." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleQuests.map((quest) => <QuestCard key={quest.id} quest={quest} />)}
    </div>
  );
}
