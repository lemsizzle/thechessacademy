"use client";

import { Card } from "@/components/Card";
import type { PuzzleTrainingOverview } from "@/lib/puzzle-training/overview";
import { puzzleThemeOptions } from "@/lib/puzzle-training/types";

export function PuzzleTrainingOverviewCard({ overview }: { overview: PuzzleTrainingOverview }) {
  const latest = overview.latestWoodpeckerCycle;
  const themeName = latest
    ? puzzleThemeOptions.find((theme) => theme.id === latest.theme)?.name ?? "Mixed themes"
    : null;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Your puzzle records</p>
          <h2 className="mt-1 text-xl font-black text-white">Pick up where you left off</h2>
        </div>
        <p className="text-xs text-slate-500">Completed sessions only</p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-4" aria-labelledby="survival-records-heading">
          <p id="survival-records-heading" className="text-xs font-black uppercase tracking-wide text-amber-100">Survival high scores</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["All time", overview.survival.allTimeScore],
              ["Monthly", overview.survival.monthScore],
              ["Weekly", overview.survival.weekScore]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border border-white/10 bg-slate-950/45 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-500 sm:text-xs">{label}</p>
                <p className="mt-1 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-4" aria-labelledby="woodpecker-records-heading">
          <div className="flex items-center justify-between gap-3">
            <p id="woodpecker-records-heading" className="text-xs font-black uppercase tracking-wide text-fuchsia-100">Latest Woodpecker cycle</p>
            {latest && <span className="text-xs font-bold text-slate-500">{themeName} · {latest.setSize} puzzles</span>}
          </div>
          {latest ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-white/10 bg-slate-950/45 p-3 text-center"><p className="text-xs font-bold uppercase text-slate-500">PPM</p><p className="mt-1 text-2xl font-black text-white">{latest.puzzlesPerMinute.toFixed(1)}</p></div>
              <div className="rounded-md border border-white/10 bg-slate-950/45 p-3 text-center"><p className="text-xs font-bold uppercase text-slate-500">Accuracy</p><p className="mt-1 text-2xl font-black text-white">{latest.accuracy}%</p></div>
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">Finish a Woodpecker cycle to record your speed and accuracy.</p>
          )}
        </section>
      </div>
    </Card>
  );
}
