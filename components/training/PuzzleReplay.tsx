"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { BoardViewport } from "@/chess/components/BoardViewport";
import { BoardSettings } from "@/chess/components/BoardSettings";
import { PromotionDialog } from "@/chess/components/PromotionDialog";
import type { PromotionPiece } from "@/chess/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { DashboardPeriod } from "@/lib/puzzle-training/dashboard";
import type { PublicTrainingPuzzle, PuzzleMoveResult } from "@/lib/puzzle-training/types";

export function PuzzleReplay({ puzzleId, period }: { puzzleId: string; period: DashboardPeriod }) {
  const [puzzle, setPuzzle] = useState<PublicTrainingPuzzle | null>(null);
  const [fen, setFen] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PuzzleMoveResult | null>(null);
  const [message, setMessage] = useState("Ready for another look? Take your time and plan the whole line.");
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [arrows, setArrows] = useState<{ startSquare: string; endSquare: string; color: string }[]>([]);
  const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { controller.current?.abort(); if (replyTimer.current) clearTimeout(replyTimer.current); }, []);

  async function request(url: string, body: unknown) {
    const pending = new AbortController();
    controller.current = pending;
    const timeout = setTimeout(() => pending.abort(), 20_000);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: pending.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "That didn’t save. Please try again.");
      return data;
    } finally { clearTimeout(timeout); }
  }

  async function start() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("Preparing your replay…");
    try {
      const data = await request("/api/student/puzzle-training/replay", { puzzleId }) as { puzzle: PublicTrainingPuzzle };
      setPuzzle(data.puzzle); setFen(data.puzzle.displayFen); setToken(data.puzzle.token);
      setResult(null); setLastMove(null); setArrows([]);
      setMessage(`${data.puzzle.sideToMove} to move. Find the strongest move, then follow the reply.`);
    } catch (error) { setMessage(error instanceof Error && error.name !== "AbortError" ? error.message : "Loading took too long. Please try again."); }
    finally { locked.current = false; setBusy(false); }
  }

  async function move(from: string, to: string, piece?: PromotionPiece) {
    if (!puzzle || locked.current || result?.completed) return;
    const chess = new Chess(fen);
    if (!piece && chess.get(from as Parameters<typeof chess.get>[0])?.type === "p" && /[18]$/.test(to)) { setPromotion({ from, to }); return; }
    try { if (!chess.move({ from, to, promotion: piece })) return; } catch { return; }
    const previousFen = fen;
    locked.current = true; setBusy(true); setArrows([]); setFen(chess.fen()); setLastMove([from, to]);
    try {
      const data = await request("/api/student/puzzle-training/move", { token, move: { from, to, promotion: piece } }) as PuzzleMoveResult;
      setToken(data.token); setResult(data); setMessage(data.message);
      if (data.accepted && data.opponentMove && data.studentFen) {
        setFen(data.studentFen);
        replyTimer.current = setTimeout(() => {
          setFen(data.positionFen); setLastMove([data.opponentMove!.slice(0, 2), data.opponentMove!.slice(2, 4)]);
          locked.current = false; setBusy(false); replyTimer.current = null;
        }, 260);
        return;
      }
      setFen(data.positionFen);
      if (!data.accepted) setLastMove(null);
    } catch (error) { setFen(previousFen); setLastMove(null); setMessage(error instanceof Error && error.name !== "AbortError" ? error.message : "We couldn’t confirm that move. Please try it again."); }
    locked.current = false; setBusy(false);
  }

  async function hint() {
    if (!puzzle || locked.current || result?.completed) return;
    locked.current = true; setBusy(true);
    try {
      const data = await request("/api/student/puzzle-training/hint", { token }) as { token: string; hint: { source: string; destination?: string } };
      setToken(data.token);
      setMessage(data.hint.destination ? `Try moving from ${data.hint.source} to ${data.hint.destination}.` : `Look at the piece on ${data.hint.source}. What can it do?`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Hint unavailable."); }
    finally { locked.current = false; setBusy(false); }
  }

  const back = `/student/training/dashboard?view=replay&period=${period}`;
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
    <BoardViewport maxWidth={660}>
      {puzzle ? <><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-cyan-100">{puzzle.sideToMove} to move</p><BoardSettings /></div><AcademyChessboard boardId={`dashboard-replay-${puzzleId}`} fen={fen} orientation={puzzle.orientation} humanColor={puzzle.orientation} interactive={!busy && !result?.completed && !promotion} lastMove={lastMove} onMove={(from, to) => void move(from, to)} allowDrawingArrows arrows={arrows} onArrowsChange={setArrows} onClearAnnotations={() => setArrows([])} /></> : <Card className="flex aspect-square items-center justify-center p-6 text-center"><div><span aria-hidden="true" className="text-6xl text-cyan-200">↺</span><h2 className="mt-4 text-2xl font-black text-white">A fresh chance to solve it</h2><p className="mt-3 text-sm text-slate-400">The answer stays hidden. Start when you’re ready.</p><Button onClick={() => void start()} disabled={busy} className="mt-5">{busy ? "Loading…" : "Start replay"}</Button></div></Card>}
    </BoardViewport>
    <Card className="h-fit space-y-4 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-widest text-amber-200">Practice, not a test</p><h2 className="text-2xl font-black text-white">Look. Plan. Try again.</h2><p className="text-sm leading-6 text-slate-300">Look for checks, captures, and threats. What will your opponent do next?</p><p role="status" aria-live="polite" className={`rounded-lg border p-4 text-sm font-bold leading-6 ${result?.completed ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"}`}>{message}</p>
      {puzzle && !result?.completed ? <Button variant="secondary" onClick={() => void hint()} disabled={busy}>Give me a hint</Button> : null}
      {result?.completed ? <Button onClick={() => void start()} disabled={busy}>Try once more</Button> : null}
      <p className="text-xs leading-5 text-slate-400">A clean solve clears this puzzle from your replay list. Hints are welcome, but you’ll need another try without help to clear it. No XP, coins, badges, or quest progress are awarded for replays.</p><Link className="inline-flex min-h-11 items-center font-bold text-cyan-200 underline" href={back}>← Back to replay list</Link>
    </Card>
    {promotion && puzzle ? <PromotionDialog color={puzzle.orientation} onChoose={(piece) => { const pending = promotion; setPromotion(null); void move(pending.from, pending.to, piece); }} onCancel={() => setPromotion(null)} /> : null}
  </div>;
}
