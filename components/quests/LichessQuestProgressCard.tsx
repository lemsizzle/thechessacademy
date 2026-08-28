import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { QuestConditionBadge } from "@/components/quests/QuestConditionBadge";
import { coinsFromXp } from "@/lib/avatar/economy";
import { formatQuestEvidence } from "@/lib/quests/formatQuestEvidence";
import { formatCountdown } from "@/lib/quests/questAttempts";
import { getSafeQuestLink } from "@/lib/quests/questLinks";
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
  const completionLink = getSafeQuestLink(quest.completionUrl);
  const xpAwarded = completion?.xpAwarded ?? 0;
  const coinsAwarded = coinsFromXp(xpAwarded);

  return (
    <Card className={`p-4 ${completion ? "border-emerald-300/30 bg-emerald-300/[0.06]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {completion && (
            <div
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-emerald-200/70 bg-emerald-300/20 text-2xl font-black text-emerald-100 shadow-lg shadow-emerald-400/20"
              role="img"
              aria-label="Quest completed successfully"
            >
              <span aria-hidden="true">☺</span>
              <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950 bg-emerald-300 text-sm text-emerald-950">
                ✓
              </span>
            </div>
          )}
          <div className="min-w-0">
            <QuestConditionBadge quest={quest} />
            <h3 className="mt-2 font-black text-white">{quest.title}</h3>
          </div>
        </div>
        <span className="rounded bg-white/10 px-2 py-1 text-xs font-bold text-slate-200">{status}</span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{quest.description}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">
        {completion ? (
          <>
            <span>Completed {new Date(completion.completedAt).toLocaleString()}</span>
            <span className="text-emerald-100">Rewards earned</span>
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
      {completion && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm font-black">
          <div className="rounded border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-amber-100">
            {xpAwarded} XP earned
          </div>
          <div className="rounded border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-cyan-100">
            {coinsAwarded} coins earned
          </div>
        </div>
      )}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-amber-200" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>{currentValue !== undefined ? `${currentValue} / ${requiredValue}` : "Not synced"}</span>
        <span>{completion ? "Rewards claimed" : `${quest.xpReward} XP`}</span>
      </div>
      {completionLink && (
        <div className="mt-3">
          <Button href={completionLink.href} variant="secondary" target={completionLink.external ? "_blank" : undefined} rel={completionLink.external ? "noopener noreferrer" : undefined}>
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
