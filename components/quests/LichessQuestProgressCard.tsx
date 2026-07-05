import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { QuestConditionBadge } from "@/components/quests/QuestConditionBadge";
import { formatQuestEvidence } from "@/lib/quests/formatQuestEvidence";
import { formatCountdown } from "@/lib/quests/questAttempts";
import { isSafeExternalUrl } from "@/lib/resources";
import type { LichessQuestProgress, PendingQuestAward, Quest, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";

export function LichessQuestProgressCard({
  quest,
  progress,
  award,
  completion,
  attempt,
  now = Date.now(),
  onStart
}: {
  quest: Quest;
  progress?: LichessQuestProgress;
  award?: PendingQuestAward;
  completion?: QuestCompletionEvent;
  attempt?: StudentQuestAttempt;
  now?: number;
  onStart?: () => void;
}) {
  const requiredValue = progress?.requiredValue ?? quest.requiredScore ?? quest.requiredCount ?? 1;
  const currentValue = completion ? requiredValue : progress ? progress.currentValue : attempt ? 0 : undefined;
  const percent = completion
    ? 100
    : currentValue !== undefined
      ? Math.min(100, Math.round((currentValue / Math.max(1, requiredValue)) * 100))
      : 0;
  const status = completion
    ? "Completed"
    : award?.status === "pending"
      ? "Pending approval"
      : award?.status === "rejected"
        ? "Not approved"
        : progress?.completed
          ? "Ready for review"
          : attempt
            ? "In progress"
            : progress && progress.currentValue > 0
              ? "Progress synced"
              : "Not started";
  const evidence = formatQuestEvidence(completion?.evidence ?? progress?.evidence ?? "");
  const countdown = attempt ? formatCountdown(new Date(attempt.expiresAt).getTime() - now) : "";
  const completionUrl = quest.completionUrl?.trim();
  const hasSafeCompletionUrl = completionUrl ? isSafeExternalUrl(completionUrl) : false;

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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">
        {completion ? (
          <>
            <span>Completed {new Date(completion.completedAt).toLocaleString()}</span>
            <span className="text-emerald-100">XP awarded</span>
          </>
        ) : attempt ? (
          <>
            <span>Started {new Date(attempt.startedAt).toLocaleString()}</span>
            <span className="text-cyan-100">{countdown} left</span>
          </>
        ) : (
          <>
            <span>Start this quest to begin its timer.</span>
            <Button variant="secondary" onClick={onStart}>Start</Button>
          </>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-amber-200" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>{currentValue !== undefined ? `${currentValue} / ${requiredValue}` : "Not synced"}</span>
        <span>{quest.xpReward} XP</span>
      </div>
      {hasSafeCompletionUrl && (
        <div className="mt-3">
          <Button href={completionUrl} variant="secondary" target="_blank" rel="noopener noreferrer">
            Open Quest Link
          </Button>
        </div>
      )}
      {progress?.accuracy !== undefined && <p className="mt-2 text-xs text-cyan-100">Accuracy: {progress.accuracy}%</p>}
      {completion && <p className="mt-2 text-xs text-emerald-100">Completed on {new Date(completion.completedAt).toLocaleDateString()}.</p>}
      {evidence && <p className="mt-2 text-xs text-slate-500">{evidence}{!completion && progress?.mode === "mock" ? " Mock fallback." : ""}</p>}
    </Card>
  );
}
