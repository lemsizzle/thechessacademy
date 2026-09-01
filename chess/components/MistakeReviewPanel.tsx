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
  explorationMoveCount: number;
  queueSave?: { status: "idle" | "saving" | "saved" | "error"; message: string };
  onScan: () => void;
  onCancel: () => void;
  onOpen: (index?: number) => void;
  onClose: () => void;
  onGoTo: (index: number) => void;
  onReveal: () => void;
  onUndoExplorationMove: () => void;
  onResetExploration: () => void;
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
      <h3 className="mt-0.5 text-lg font-black text-white">Review my three key moments.</h3>
    </div>
    <div className="p-4">
      {props.status === "idle" && <>
        <p className="text-sm leading-6 text-slate-300">Find up to three turning points, understand what changed, and retry each position yourself.</p>
        <button type="button" onClick={props.onScan} className="mt-4 w-full rounded-md bg-[#7fa650] px-4 py-3 text-sm font-black text-white shadow hover:bg-[#8bb45a]">Find my key moments</button>
      </>}

      {props.status === "scanning" && <div aria-live="polite">
        <div className="flex items-center justify-between text-sm"><span className="font-bold text-white">Finding your key moments…</span><span className="font-mono text-slate-400">{props.progress.current}/{props.progress.total}</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-[#7fa650] transition-[width]" style={{ width: `${percent}%` }} /></div>
        <p className="mt-2 text-xs text-slate-500">This runs locally in your browser. Longer games take a little more time.</p>
        <button type="button" onClick={props.onCancel} className="mt-3 text-xs font-black text-slate-300 hover:text-white">Cancel analysis</button>
      </div>}

      {props.status === "error" && <>
        <p className="rounded-md border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{props.error}</p>
        <button type="button" onClick={props.onScan} className="mt-3 rounded-md bg-[#7fa650] px-4 py-2 text-sm font-black text-white">Try again</button>
      </>}

      {props.status === "ready" && props.activeIndex === null && <>
        {props.queueSave?.message && <p className={`mb-3 rounded-md border p-3 text-xs font-bold ${props.queueSave.status === "error" ? "border-rose-300/25 bg-rose-300/10 text-rose-100" : props.queueSave.status === "saved" ? "border-violet-300/25 bg-violet-300/10 text-violet-100" : "border-white/10 bg-white/5 text-slate-300"}`}>{props.queueSave.message}</p>}
        {props.puzzles.length ? <>
          <div className="grid grid-cols-2 gap-2 text-center">
            {(["mistake", "blunder"] as const).map((severity) => <div key={severity} className={`rounded-md px-2 py-3 ${severityStyle[severity]}`}><p className="text-xl font-black">{counts[severity]}</p><p className="text-[10px] font-black uppercase">{severity}{counts[severity] === 1 ? "" : "s"}</p></div>)}
          </div>
          <p className="mt-3 text-sm leading-5 text-slate-300">Retry each turning point and find a stronger move yourself.</p>
          <button type="button" onClick={() => props.onOpen(0)} className="mt-4 w-full rounded-md bg-[#7fa650] px-4 py-3 text-sm font-black text-white hover:bg-[#8bb45a]">Review {props.puzzles.length} key moment{props.puzzles.length === 1 ? "" : "s"}</button>
        </> : <>
          <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-4 text-center"><p className="text-2xl">✓</p><p className="mt-1 font-black text-emerald-100">No significant mistakes found</p><p className="mt-1 text-xs text-slate-400">Stockfish found no mistakes or blunders in your moves.</p></div>
          <button type="button" onClick={props.onScan} className="mt-3 w-full rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-300 hover:bg-white/5">Analyze again</button>
        </>}
      </>}

      {props.status === "ready" && props.activeIndex !== null && props.activePuzzle && <div aria-live="polite">
        <div className="flex items-center justify-between gap-3"><span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${severityStyle[props.activePuzzle.severity]}`}>{props.activePuzzle.severity}</span><span className="text-xs font-bold text-slate-400">Key moment {props.activeIndex + 1} of {props.puzzles.length}</span></div>
        <p className="mt-3 text-lg font-black text-white">You played {props.activePuzzle.playedMoveSan}</p>
        <p className="mt-1 text-sm text-slate-300">The red arrow shows the move played in the game. Find the best move instead.</p>
        <div className="mt-3 rounded-md border border-rose-300/20 bg-rose-300/10 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-200">Why this was a mistake</p>
          <p className="mt-1 text-sm leading-5 text-rose-50">{props.activePuzzle.explanation}</p>
        </div>
        {!props.result && <p className="mt-3 rounded-md bg-black/20 p-3 text-xs text-slate-400">Move {props.activePuzzle.moveNumber} · about {(props.activePuzzle.centipawnLoss / 100).toFixed(1)} pawns lost</p>}
        {props.result?.status === "incorrect" && <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/10 p-3"><p className="text-sm font-black text-amber-100">{props.result.attemptedSan} is not the best move. Try again.</p><button type="button" onClick={props.onReveal} className="mt-2 text-xs font-black text-amber-50 underline underline-offset-2">View the solution</button></div>}
        {(props.result?.status === "correct" || props.result?.status === "revealed") && <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3">
          <p className="text-sm font-black text-emerald-100">{props.result.status === "correct" ? `Correct — ${props.result.attemptedSan}!` : `Best move: ${props.activePuzzle.bestMoveSan}`}</p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-200">Why this move works</p>
          <p className="mt-1 text-sm leading-5 text-emerald-50">{props.result.status === "correct" && props.result.attemptedSan !== props.activePuzzle.bestMoveSan
            ? `${props.result.attemptedSan} is also a strong move. It avoids the problem from the game and keeps your position active.`
            : props.activePuzzle.solutionExplanation}</p>
          {props.activePuzzle.bestLineSan && <p className="mt-2 text-xs leading-5 text-emerald-100/80">Best line: {props.activePuzzle.bestLineSan}</p>}
        </div>}
        {props.result?.status === "correct" && <div className="mt-3 rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3">
          <p className="text-sm font-black text-cyan-100">Board unlocked</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Play any legal move for either side. Undo or reset the line to explore a different idea.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={props.explorationMoveCount === 0} onClick={props.onUndoExplorationMove} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35">Undo move</button>
            <button type="button" disabled={props.explorationMoveCount === 0} onClick={props.onResetExploration} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35">Reset line</button>
          </div>
          {props.explorationMoveCount > 0 && <p className="mt-2 text-center text-[11px] font-bold text-cyan-100/80">{props.explorationMoveCount} exploration move{props.explorationMoveCount === 1 ? "" : "s"} played</p>}
        </div>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={props.activeIndex === 0} onClick={() => props.onGoTo(props.activeIndex! - 1)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-30">Previous</button>
          {props.activeIndex < props.puzzles.length - 1 ? <button type="button" onClick={() => props.onGoTo(props.activeIndex! + 1)} className="rounded-md bg-[#7fa650] px-3 py-2 text-xs font-black text-white">Next moment</button> : <button type="button" onClick={props.onClose} className="rounded-md bg-[#7fa650] px-3 py-2 text-xs font-black text-white">Finish review</button>}
        </div>
        <button type="button" onClick={props.onClose} className="mt-3 w-full text-xs font-black text-slate-500 hover:text-slate-300">Exit mistake practice</button>
      </div>}
    </div>
  </Card>;
}
