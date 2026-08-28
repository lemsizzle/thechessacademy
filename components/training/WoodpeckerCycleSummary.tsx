"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
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
  saveState,
  saveError,
  saveDelayed,
  onReviewMistakes,
  onRetrySave,
  onContinue,
  onReturnToTraining
}: {
  result: WoodpeckerCycleResult;
  saveState: "idle" | "saving" | "saved" | "error";
  saveError?: string;
  saveDelayed: boolean;
  onReviewMistakes: () => void;
  onRetrySave: () => void;
  onContinue: () => void;
  onReturnToTraining: () => void;
}) {
  const isFinalCycle = result.cycle >= WOODPECKER_CYCLE_COUNT;
  const mistakeCount = result.mistakePuzzleIds.length;
  const isSaveDelayed = saveState === "saving" && saveDelayed;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="woodpecker-cycle-results-title"
          aria-describedby="woodpecker-cycle-results-description"
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
          className="w-full max-w-5xl"
        >
          <Card className="overflow-hidden border-cyan-200/25 bg-slate-950/95 shadow-[0_24px_100px_rgba(0,0,0,0.65)]">
            <div className="border-b border-white/10 bg-gradient-to-r from-cyan-300/10 via-slate-950 to-amber-300/10 px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Cycle {result.cycle} of {WOODPECKER_CYCLE_COUNT} complete</p>
              <h2 id="woodpecker-cycle-results-title" className="mt-2 text-3xl font-black text-white sm:text-4xl">Your cycle stats</h2>
              <p id="woodpecker-cycle-results-description" className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {isFinalCycle
                  ? "You finished all three cycles. Check your final stats, then complete the training set."
                  : `Cycle ${result.cycle + 1} repeats the same puzzle set so you can solve it faster and more accurately.`}
              </p>
            </div>

            <div className="p-5 sm:p-7">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ["Solved", result.puzzlesSolved],
                  ["Puzzles/min", result.puzzlesPerMinute.toFixed(1)],
                  ["Accuracy", `${result.accuracy}%`],
                  ["Incorrect moves", result.incorrectMoves],
                  ["Active time", formatActiveTime(result.elapsedSeconds)]
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-black text-white sm:text-3xl">{value}</p>
                  </div>
                ))}
              </div>

              <div className={`mt-5 rounded-lg border p-4 ${mistakeCount ? "border-fuchsia-300/30 bg-fuchsia-300/10" : "border-emerald-300/30 bg-emerald-300/10"}`}>
                <p className={`font-black ${mistakeCount ? "text-fuchsia-100" : "text-emerald-100"}`}>
                  {mistakeCount
                    ? `${mistakeCount} ${mistakeCount === 1 ? "puzzle needs" : "puzzles need"} another look.`
                    : "Clean cycle — there are no mistake puzzles to review."}
                </p>
                {mistakeCount > 0 && <p className="mt-1 text-sm text-slate-300">Mistake review is practice only and will not change these cycle stats.</p>}
                {result.reviewed && <p className="mt-2 text-xs font-black uppercase tracking-wide text-emerald-200">Mistake review completed</p>}
              </div>

              {saveState !== "saved" && (
                <div className={`mt-4 rounded-lg border p-4 ${saveState === "error" ? "border-rose-300/40 bg-rose-300/10 text-rose-100" : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"}`} aria-live="polite">
                  <p className="font-black">{saveState === "error"
                    ? "Cycle verification needs another try."
                    : isSaveDelayed
                      ? "Verification is taking a little longer."
                      : isFinalCycle
                        ? "Verifying Conquer the Woodpecker..."
                        : "Saving your verified cycle..."}</p>
                  {isSaveDelayed && (
                    <p className="mt-1 text-sm text-slate-300">Your completed cycle is still being saved. You do not need to retry.</p>
                  )}
                  {saveState === "error" && (
                    <>
                      <p className="mt-1 text-sm text-slate-300">{saveError || "The cycle could not be saved."}</p>
                      <Button type="button" variant="secondary" onClick={onRetrySave} className="mt-3">Retry Save</Button>
                    </>
                  )}
                  {saveState !== "error" && !isSaveDelayed && (
                    <p className="mt-2 text-xs text-slate-300">You can keep training while this sync finishes.</p>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button type="button" onClick={onContinue} autoFocus className="min-h-14 flex-1 px-8 text-base sm:text-lg">
                  {isFinalCycle ? "Finish Training" : "Next Cycle"}
                </Button>
                {mistakeCount > 0 && (
                  <Button type="button" variant="secondary" onClick={onReviewMistakes} className="min-h-14 px-6 text-base">
                    {result.reviewed ? "Review Mistakes Again" : "Review Mistakes"}
                  </Button>
                )}
              </div>

              <div className="mt-3 text-center">
                <Button type="button" variant="ghost" onClick={onReturnToTraining} className="w-full sm:w-auto">Return to Training</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
