"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { WOODPECKER_CYCLE_COUNT, type WoodpeckerCycleResult } from "@/lib/puzzle-training/modes";

function formatActiveTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function WoodpeckerCycleSummary({
  result,
  onReviewMistakes,
  onContinue
}: {
  result: WoodpeckerCycleResult;
  onReviewMistakes: () => void;
  onContinue: () => void;
}) {
  const isFinalCycle = result.cycle >= WOODPECKER_CYCLE_COUNT;
  const mistakeCount = result.mistakePuzzleIds.length;

  return (
    <Card className="p-6">
      <p className="text-xs font-black uppercase text-amber-200">Cycle {result.cycle} of {WOODPECKER_CYCLE_COUNT} complete</p>
      <h2 className="mt-2 text-3xl font-black text-white">Woodpecker cycle results</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Review this pass before you move on. Your next cycle will repeat the same puzzle set.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Solved", result.puzzlesSolved],
          ["Puzzles/min", result.puzzlesPerMinute.toFixed(1)],
          ["Accuracy", `${result.accuracy}%`],
          ["Incorrect moves", result.incorrectMoves],
          ["Active time", formatActiveTime(result.elapsedSeconds)]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-md border border-white/10 bg-white/5 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className={`mt-6 rounded-lg border p-4 ${mistakeCount ? "border-fuchsia-300/30 bg-fuchsia-300/10" : "border-emerald-300/30 bg-emerald-300/10"}`}>
        <p className={`font-black ${mistakeCount ? "text-fuchsia-100" : "text-emerald-100"}`}>
          {mistakeCount
            ? `${mistakeCount} ${mistakeCount === 1 ? "puzzle needs" : "puzzles need"} another look.`
            : "Clean cycle — there are no mistake puzzles to review."}
        </p>
        {mistakeCount > 0 && <p className="mt-1 text-sm text-slate-300">Mistake review is practice only and will not change these cycle stats.</p>}
        {result.reviewed && <p className="mt-2 text-xs font-black uppercase tracking-wide text-emerald-200">Mistake review completed</p>}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {mistakeCount > 0 && <Button type="button" variant="secondary" onClick={onReviewMistakes}>{result.reviewed ? "Review Mistakes Again" : "Review Mistakes"}</Button>}
        <Button type="button" onClick={onContinue}>{isFinalCycle ? "Finish Training" : `Start Cycle ${result.cycle + 1}`}</Button>
      </div>
    </Card>
  );
}
