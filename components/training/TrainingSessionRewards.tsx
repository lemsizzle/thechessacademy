"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createTrainingRewardStore, emptyTrainingTally } from "@/lib/puzzle-training/sessionRewards";

const fallback = createTrainingRewardStore("preview");
const RewardsContext = createContext<ReturnType<typeof createTrainingRewardStore> | null>(null);
const empty = emptyTrainingTally();
const serverSnapshot = () => empty;
const studentStores = new Map<string, ReturnType<typeof createTrainingRewardStore>>();

export function TrainingSessionRewardsProvider({ studentId, children }: { studentId: string; children: ReactNode }) {
  const store = useMemo(() => {
    if (typeof window !== "undefined" && studentStores.has(studentId)) return studentStores.get(studentId)!;
    let storage: Storage | undefined;
    try { if (typeof window !== "undefined") storage = window.sessionStorage; } catch { /* Restricted browser. */ }
    const next = createTrainingRewardStore(`chessquest:training-tally:v1:${studentId}`, storage);
    if (typeof window !== "undefined") studentStores.set(studentId, next);
    return next;
  }, [studentId]);
  return <RewardsContext.Provider value={store}>{children}</RewardsContext.Provider>;
}

// Only the small tally subscribes. Recording rewards does not rerender the board.
export function useTrainingRewards() {
  return useContext(RewardsContext) ?? fallback;
}

export function TrainingSessionRewards({ practiceOnly = false }: { practiceOnly?: boolean }) {
  const store = useContext(RewardsContext);
  const tally = useSyncExternalStore((store ?? fallback).subscribe, (store ?? fallback).getSnapshot, serverSnapshot);
  if (!store) return null;
  return <section aria-label="Training session rewards" className="rounded-xl border border-amber-200/25 bg-slate-950/85 px-3 py-2.5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xs font-black uppercase tracking-wide text-slate-300">Earned this session</h2>
      <button type="button" onClick={store.reset} title="Start a new tally. Your account rewards are unchanged." className="min-h-8 px-2 text-xs font-bold text-cyan-200 hover:underline focus-visible:outline focus-visible:outline-2">Reset tally</button>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" className="flex flex-wrap gap-x-5 gap-y-1 text-lg font-black tabular-nums">
      <span className="text-cyan-100"><span data-session-xp>{tally.xp.toLocaleString()}</span> XP</span>
      <span className="text-amber-200"><span data-session-coins>{tally.coins.toLocaleString()}</span> coins</span>
    </p>
    <p className="mt-1 text-[11px] leading-4 text-slate-400">{practiceOnly ? "This mode is practice only. No extra XP or coins." : "Running training total in this tab. Saved rewards only."}</p>
  </section>;
}
