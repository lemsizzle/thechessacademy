import type { Quest } from "@/lib/types";
import { getQuestConditionLabel } from "@/lib/quests/questOptions";

export function QuestConditionBadge({ quest }: { quest: Quest }) {
  return (
    <span className="rounded border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs font-black uppercase text-cyan-100">
      {getQuestConditionLabel(quest.conditionType)} - {quest.timeWindow ?? "all time"}
    </span>
  );
}
