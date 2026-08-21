"use client";

import { EmptyState } from "@/components/EmptyState";
import { QuestCard } from "@/components/QuestCard";
import type { Badge, Quest } from "@/lib/types";
import { isAutomatedQuestSource } from "@/lib/quests/questOptions";
import { useMockAdminState } from "@/lib/useMockAdminState";

export function QuestBoard({ excludeAutomated = false, initialQuests, badges }: { excludeAutomated?: boolean; initialQuests?: Quest[]; badges?: Badge[] }) {
  const { quests: adminQuests } = useMockAdminState();
  const quests = initialQuests ?? adminQuests;
  const visibleQuests = quests.filter((quest) => (
    (quest.isLive === true || quest.status === "completed")
    && (!excludeAutomated || !isAutomatedQuestSource(quest.source))
  ));

  if (!visibleQuests.length) {
    return <EmptyState title="No live quests yet" message="Check back soon for the next academy challenge." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleQuests.map((quest) => <QuestCard key={quest.id} quest={quest} badges={badges} />)}
    </div>
  );
}
