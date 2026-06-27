import { Card } from "@/components/Card";
import { QuestConditionBadge } from "@/components/quests/QuestConditionBadge";
import type { LichessQuestProgress, PendingQuestAward, Quest, QuestCompletionEvent } from "@/lib/types";

export function LichessQuestProgressCard({
  quest,
  progress,
  award,
  completion
}: {
  quest: Quest;
  progress?: LichessQuestProgress;
  award?: PendingQuestAward;
  completion?: QuestCompletionEvent;
}) {
  const requiredValue = progress?.requiredValue ?? quest.requiredScore ?? quest.requiredCount ?? 1;
  const currentValue = completion ? requiredValue : progress?.currentValue;
  const percent = completion
    ? 100
    : currentValue !== undefined
      ? Math.min(100, Math.round((currentValue / Math.max(1, requiredValue)) * 100))
      : 0;
  const status = completion ? "Completed" : award?.status === "pending" ? "Pending approval" : award?.status === "rejected" ? "Not approved" : progress?.completed ? "Ready for review" : "In progress";
  const evidence = completion?.evidence ?? progress?.evidence;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <QuestConditionBadge quest={quest} />
          <h3 className="mt-2 font-black text-white">{quest.title}</h3>
        </div>
        <span className="rounded bg-white/10 px-2 py-1 text-xs font-bold text-slate-200">{status}</span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{quest.description}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-amber-200" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>{currentValue !== undefined ? `${currentValue} / ${requiredValue}` : "Not synced"}</span>
        <span>{quest.xpReward} XP</span>
      </div>
      {progress?.accuracy !== undefined && <p className="mt-2 text-xs text-cyan-100">Accuracy: {progress.accuracy}%</p>}
      {completion && <p className="mt-2 text-xs text-emerald-100">Completed on {new Date(completion.completedAt).toLocaleDateString()}.</p>}
      {evidence && <p className="mt-2 text-xs text-slate-500">{evidence}{!completion && progress?.mode === "mock" ? " Mock fallback." : ""}</p>}
    </Card>
  );
}
