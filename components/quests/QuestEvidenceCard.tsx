import type { PendingQuestAward } from "@/lib/types";

export function QuestEvidenceCard({ award }: { award: PendingQuestAward }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm">
      <p className="font-bold text-white">{award.evidence}</p>
      <p className="mt-1 text-xs text-slate-400">{new Date(award.sourcePeriodStart).toLocaleDateString()} to {new Date(award.sourcePeriodEnd).toLocaleDateString()}</p>
    </div>
  );
}
