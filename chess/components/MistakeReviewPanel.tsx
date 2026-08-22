"use client";

import type { MistakePuzzle } from "@/chess/analysis/mistakes";
import { Card } from "@/components/Card";

type Props = {
  status: "idle" | "scanning" | "ready" | "error";
  progress: { current: number; total: number };
  error: string;
  puzzles: MistakePuzzle[];
  activeIndex: number | null;
  activePuzzle: MistakePuzzle | null;
  result: { status: "incorrect" | "correct" | "revealed"; attemptedSan: string } | null;
  onScan: () => void;
  onCancel: () => void;
  onOpen: (index?: number) => void;
  onClose: () => void;
  onGoTo: (index: number) => void;
  onReveal: () => void;
};

const severityStyle = {
  inaccuracy: "bg-amber-200/15 text-amber-100",
  mistake: "bg-orange-300/15 text-orange-100",
  blunder: "bg-rose-300/15 text-rose-100"
} as const;

export function MistakeReviewPanel(props: Props) {
  const counts = props.puzzles.reduce((total, puzzle) => ({ ...total, [puzzle.severity]: total[puzzle.severity] + 1 }), { inaccuracy: 0, mistake: 0, blunder: 0 });
  const percent = props.progress.total ? Math.round((props.progress.current / props.progress.total) * 100) : 0;

  return <Card className="overflow-hidden border-[#3b3936] bg-[#262522] p-0">
    <div className="border-b border-white/10 bg-[#302e2b] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b3d96c]">Game review</p>
      <h3 className="mt-0.5 text-lg font-black text-white">Learn from your mistakes</h3>
    </div>
    <div className="p-4">
      {props.status === "idle" && <>
        <p className="text-sm leading-6 text-slate-300">Stockfish will review the original game, find your evaluation drops, and turn each one into a private retry puzzle.</p>
        <button type="button" onClick={props.onScan} className="mt-4 w-full rounded-md bg-[#7fa650] px-4 py-3 text-sm font-black text-white shadow hover:bg-[#8bb45a]">Request a computer analysis</button>
      </>}

      {props.status === "scanning" && <div aria-live="polite">
        <div className="flex items-center justify-between text-sm"><span className="font-bold text-white">Reviewing every move…</span><span className="font-mono text-slate-400">{props.progress.current}/{props.progress.total}</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-[#7fa650] transition-[width]" style={{ width: `${percent}%` }} /></div>
        <p className="mt-2 text-xs text-slate-500">This runs locally in your browser. Longer games take a little more time.</p>
        <button type="button" onClick={props.onCancel} className="mt-3 text-xs font-black text-slate-300 hover:text-white">Cancel analysis</button>
      </div>}

      {props.status === "error" && <>
        <p className="rounded-md border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{props.error}</p>
        <button type="button" onClick={props.onScan} className="mt-3 rounded-md bg-[#7fa650] px-4 py-2 text-sm font-black text-white">Try again</button>
      </>}

      {props.status === "ready" && props.activeIndex === null && <>
        {props.puzzles.length ? <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(["inaccuracy", "mistake", "blunder"] as const).map((severity) => <div key={severity} className={`rounded-md px-2 py-3 ${severityStyle[severity]}`}><p className="text-xl font-black">{counts[severity]}</p><p className="text-[10px] font-black uppercase">{severity}{counts[severity] === 1 ? "" : "s"}</p></div>)}
          </div>
          <p className="mt-3 text-sm leading-5 text-slate-300">Retry the position before each error and find the stronger move yourself.</p>
          <button type="button" onClick={() => props.onOpen(0)} className="mt-4 w-full rounded-md bg-[#7fa650] px-4 py-3 text-sm font-black text-white hover:bg-[#8bb45a]">Practice {props.puzzles.length} mistake{props.puzzles.length === 1 ? "" : "s"}</button>
        </> : <>
          <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-4 text-center"><p className="text-2xl">✓</p><p className="mt-1 font-black text-emerald-100">No significant mistakes found</p><p className="mt-1 text-xs text-slate-400">Stockfish found no evaluation loss of half a pawn or more in your moves.</p></div>
          <button type="button" onClick={props.onScan} className="mt-3 w-full rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-300 hover:bg-white/5">Analyze again</button>
        </>}
      </>}

      {props.status === "ready" && props.activeIndex !== null && props.activePuzzle && <div aria-live="polite">
        <div className="flex items-center justify-between gap-3"><span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${severityStyle[props.activePuzzle.severity]}`}>{props.activePuzzle.severity}</span><span className="text-xs font-bold text-slate-400">Puzzle {props.activeIndex + 1} of {props.puzzles.length}</span></div>
        <p className="mt-3 text-lg font-black text-white">You played {props.activePuzzle.playedMoveSan}</p>
        <p className="mt-1 text-sm text-slate-300">Find the best move instead. Play it on the board.</p>
        {!props.result && <p className="mt-3 rounded-md bg-black/20 p-3 text-xs text-slate-400">Move {props.activePuzzle.moveNumber} · about {(props.activePuzzle.centipawnLoss / 100).toFixed(1)} pawns lost</p>}
        {props.result?.status === "incorrect" && <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/10 p-3"><p className="text-sm font-black text-amber-100">{props.result.attemptedSan} is not the best move. Try again.</p><button type="button" onClick={props.onReveal} className="mt-2 text-xs font-black text-amber-50 underline underline-offset-2">View the solution</button></div>}
        {(props.result?.status === "correct" || props.result?.status === "revealed") && <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3"><p className="text-sm font-black text-emerald-100">{props.result.status === "correct" ? `Correct — ${props.activePuzzle.bestMoveSan}!` : `Best move: ${props.activePuzzle.bestMoveSan}`}</p>{props.activePuzzle.bestLineSan && <p className="mt-1 text-xs leading-5 text-emerald-50">Best line: {props.activePuzzle.bestLineSan}</p>}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={props.activeIndex === 0} onClick={() => props.onGoTo(props.activeIndex! - 1)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-30">Previous</button>
          {props.activeIndex < props.puzzles.length - 1 ? <button type="button" onClick={() => props.onGoTo(props.activeIndex! + 1)} className="rounded-md bg-[#7fa650] px-3 py-2 text-xs font-black text-white">Next puzzle</button> : <button type="button" onClick={props.onClose} className="rounded-md bg-[#7fa650] px-3 py-2 text-xs font-black text-white">Finish review</button>}
        </div>
        <button type="button" onClick={props.onClose} className="mt-3 w-full text-xs font-black text-slate-500 hover:text-slate-300">Exit mistake practice</button>
      </div>}
    </div>
  </Card>;
}
