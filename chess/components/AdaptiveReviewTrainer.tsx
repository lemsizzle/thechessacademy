"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { BOARD_ANNOTATION_COLORS, type BoardArrow } from "@/chess/components/boardAnnotations";
import type { AdaptiveReviewItem, AdaptiveReviewSummary } from "@/chess/training/adaptiveReviewServer";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type QueueResponse = { items?: AdaptiveReviewItem[]; summary?: AdaptiveReviewSummary; error?: string };
type AttemptResult = { outcome: "correct" | "incorrect" | "revealed"; bestMoveSan: string; bestMoveUci: string; solutionExplanation: string; bestLineSan: string; error?: string };

function movePosition(fen: string, uci: string) {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(uci.slice(0, 2) as Parameters<typeof chess.get>[0]);
    const promotion = piece?.type === "p" && /[18]$/.test(uci.slice(2, 4)) ? (uci[4] ?? "q") : uci[4];
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion });
    return move ? { fen: chess.fen(), san: move.san, uci: `${move.from}${move.to}${move.promotion ?? ""}` } : null;
  } catch {
    return null;
  }
}

const emptySummary: AdaptiveReviewSummary = { total: 0, due: 0, learning: 0, review: 0, mastered: 0, attempts: 0, correct: 0, accuracy: 0 };

function reviewPrompt(item: AdaptiveReviewItem) {
  return item.playedMoveUci
    ? `Find the stronger move. The red arrow shows what happened in ${item.sourceKind === "survival" ? "Survival" : "your game"}.`
    : "Find the stronger move in this Survival position.";
}

export function AdaptiveReviewTrainer({
  autoStart = false,
  onExit,
  summaryOnly = false
}: {
  autoStart?: boolean;
  onExit?: () => void;
  summaryOnly?: boolean;
}) {
  const [items, setItems] = useState<AdaptiveReviewItem[]>([]);
  const [summary, setSummary] = useState<AdaptiveReviewSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [practicing, setPracticing] = useState(false);
  const [displayFen, setDisplayFen] = useState("");
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [practiceArrows, setPracticeArrows] = useState<BoardArrow[]>([]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());
  const shouldAutoStart = useRef(autoStart);

  const beginItem = useCallback((item: AdaptiveReviewItem) => {
    setPracticing(true);
    setDisplayFen(item.fen);
    setLastMove(null);
    setPracticeArrows([]);
    setResult(null);
    setMessage(reviewPrompt(item));
    startedAt.current = Date.now();
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/student/adaptive-review", { cache: "no-store" });
      const body = await response.json() as QueueResponse;
      if (!response.ok || !body.items || !body.summary) throw new Error(body.error ?? "Review queue could not be loaded.");
      setItems(body.items);
      setSummary(body.summary);
      if (!body.items.length) {
        setPracticing(false);
      } else if (shouldAutoStart.current && !summaryOnly) {
        shouldAutoStart.current = false;
        beginItem(body.items[0]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [beginItem, summaryOnly]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const current = items[0] ?? null;

  function begin() {
    if (!current) return;
    beginItem(current);
  }

  async function submitAttempt(moveUci?: string, reveal = false) {
    if (!current || saving) return;
    const played = moveUci ? movePosition(current.fen, moveUci) : null;
    if (!reveal && !played) return;
    if (!reveal && played) {
      setDisplayFen(played.fen);
      setLastMove([played.uci.slice(0, 2), played.uci.slice(2, 4)]);
    }
    setSaving(true);
    setMessage(reveal ? "Showing the solution…" : "Checking your move…");
    try {
      const response = await fetch("/api/student/adaptive-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: current.id,
          moveUci: played?.uci,
          reveal,
          responseMs: Date.now() - startedAt.current
        })
      });
      const body = await response.json() as AttemptResult;
      if (!response.ok) throw new Error(body.error ?? "Your review could not be saved.");
      setResult(body);
      if (body.outcome === "incorrect") {
        setDisplayFen(current.fen);
        setLastMove(null);
        setMessage("That move is legal, but it does not fix the problem. Try the position again.");
        startedAt.current = Date.now();
      } else {
        if (body.outcome === "revealed") {
          const solution = movePosition(current.fen, body.bestMoveUci);
          if (solution) {
            setDisplayFen(solution.fen);
            setLastMove([solution.uci.slice(0, 2), solution.uci.slice(2, 4)]);
          }
        }
        setMessage(body.outcome === "correct" ? "Correct! This position is scheduled for a later review." : "Study the idea, then try it again when it returns to your queue.");
      }
    } catch (error) {
      setDisplayFen(current.fen);
      setLastMove(null);
      setMessage(error instanceof Error ? error.message : "Your review could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function nextPosition() {
    const next = items.slice(1);
    setItems(next);
    setResult(null);
    setLastMove(null);
    setPracticeArrows([]);
    if (next[0]) {
      setDisplayFen(next[0].fen);
      setMessage(reviewPrompt(next[0]));
      startedAt.current = Date.now();
    } else {
      setPracticing(false);
      setMessage("Review complete. Your next positions will appear when they are due.");
      void loadQueue();
    }
  }

  if (loading) return <Card className="p-5 text-sm text-slate-300">{summaryOnly ? "Loading your mistake-review stats…" : "Preparing your mistake review…"}</Card>;

  if (summaryOnly) {
    return (
      <Card className="border-violet-300/20 bg-violet-300/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-200">Mistake review</p>
            <h3 className="mt-1 text-xl font-black text-white">Learning progress</h3>
          </div>
          <p className="text-xs font-bold text-slate-400">{summary.attempts} attempts · {summary.correct} correct</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[["Due", summary.due], ["Learning", summary.learning], ["Reviewing", summary.review], ["Mastered", summary.mastered], ["Accuracy", `${summary.accuracy}%`]].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-white/10 bg-slate-950/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-500 sm:text-xs">{label}</p>
              <p className="mt-1 text-xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>
        {message && <p className="mt-3 text-sm text-rose-100" role="alert">{message}</p>}
      </Card>
    );
  }

  if (!practicing || !current) {
    return <Card className="overflow-hidden border-violet-300/20 bg-violet-300/5 p-0">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-widest text-violet-200">Adaptive training</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-2xl font-black text-white">Review your mistakes</h2><p className="mt-1 text-sm text-slate-300">Game and Survival positions return at the right time until the idea sticks.</p></div>
          {summary.due > 0 && <span className="rounded-full bg-violet-300 px-3 py-1 text-sm font-black text-slate-950">{summary.due} due</span>}
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[["Due", summary.due], ["Learning", summary.learning], ["Reviewing", summary.review], ["Mastered", summary.mastered], ["Accuracy", `${summary.accuracy}%`]].map(([label, value]) => <div key={String(label)} className="rounded-md border border-white/10 bg-slate-950/50 p-3 text-center"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>)}
        </div>
        {summary.due > 0 ? <Button type="button" onClick={begin} className="mt-4">Start mistake review</Button> : summary.total > 0 ? <p className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">You are caught up. New reviews will appear here when they are due.</p> : <p className="mt-4 rounded-md border border-cyan-200/20 bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-50">Mistakes from Survival are added automatically. You can also analyze a completed game to add its key mistakes.</p>}
        {message && <p className="mt-3 text-sm text-slate-300" aria-live="polite">{message}</p>}
        {onExit && <Button type="button" variant="ghost" onClick={onExit} className="mt-4">Back to Puzzle Modes</Button>}
      </div>
    </Card>;
  }

  const oldMoveArrow: BoardArrow[] = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(current.playedMoveUci) ? [{
    startSquare: current.playedMoveUci.slice(0, 2),
    endSquare: current.playedMoveUci.slice(2, 4),
    color: BOARD_ANNOTATION_COLORS.danger
  }] : [];
  const solved = result?.outcome === "correct" || result?.outcome === "revealed";

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,640px)_minmax(280px,1fr)]">
    <div className="mx-auto w-full max-w-[640px] overflow-hidden rounded-lg border border-violet-300/25 bg-slate-950/70">
      <AcademyChessboard
        boardId={`adaptive-review-${current.id}`}
        fen={displayFen || current.fen}
        orientation={current.color}
        humanColor={current.color}
        interactive={!solved && !saving}
        lastMove={lastMove}
        arrows={[...(!lastMove ? oldMoveArrow : []), ...practiceArrows]}
        allowDrawingArrows
        onArrowsChange={(arrows) => setPracticeArrows(arrows.filter((arrow) => !oldMoveArrow.some((guide) => (
          guide.startSquare === arrow.startSquare
          && guide.endSquare === arrow.endSquare
          && guide.color === arrow.color
        ))))}
        onClearAnnotations={() => setPracticeArrows([])}
        onMove={(from, to) => {
          const piece = new Chess(current.fen).get(from as Parameters<Chess["get"]>[0]);
          const promotion = piece?.type === "p" && /[18]$/.test(to) ? "q" : "";
          void submitAttempt(`${from}${to}${promotion}`);
        }}
      />
    </div>
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3"><span className={`rounded px-2 py-1 text-xs font-black uppercase ${current.severity === "blunder" ? "bg-rose-300/15 text-rose-100" : "bg-orange-300/15 text-orange-100"}`}>{current.severity}</span><span className="text-xs font-bold text-slate-400">{items.length} due</span></div>
        <h2 className="mt-3 text-2xl font-black text-white">
          {current.sourceKind === "survival"
            ? current.playedMoveSan ? `You tried ${current.playedMoveSan}` : "Survival puzzle to revisit"
            : `You played ${current.playedMoveSan}`}
        </h2>
        <div className="mt-3 rounded-md border border-rose-300/20 bg-rose-300/10 p-3"><p className="text-xs font-black uppercase text-rose-200">Remember the problem</p><p className="mt-1 text-sm leading-6 text-rose-50">{current.explanation}</p></div>
        <p className="mt-3 rounded-md border border-white/10 bg-white/5 p-3 text-sm font-bold text-slate-200" aria-live="polite">{message}</p>
        {result?.outcome === "incorrect" && <Button type="button" variant="ghost" disabled={saving} onClick={() => void submitAttempt(undefined, true)} className="mt-3">Show the answer</Button>}
        {!result && <Button type="button" variant="ghost" disabled={saving} onClick={() => void submitAttempt(undefined, true)} className="mt-3">I’m stuck — show me</Button>}
        {solved && <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3"><p className="font-black text-emerald-100">{result.outcome === "correct" ? "You found it!" : `Best move: ${result.bestMoveSan}`}</p><p className="mt-2 text-sm leading-6 text-emerald-50">{result.solutionExplanation}</p>{result.bestLineSan && <p className="mt-2 text-xs text-emerald-100/80">Example line: {result.bestLineSan}</p>}<Button type="button" onClick={nextPosition} className="mt-4">{items.length > 1 ? "Next position" : "Finish review"}</Button></div>}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          {current.sourceGameId ? <Link href={`/student/play/game/${current.sourceGameId}/analysis`} className="font-bold text-cyan-200 underline underline-offset-4">Open the original game</Link> : <span className="font-bold text-violet-200">From Survival training</span>}
          <button type="button" onClick={onExit ?? (() => setPracticing(false))} className="font-bold text-slate-400 hover:text-white">Exit review</button>
        </div>
      </Card>
    </div>
  </div>;
}
