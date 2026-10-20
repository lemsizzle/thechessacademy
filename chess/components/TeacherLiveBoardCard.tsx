"use client";

import { memo, useEffect, useState } from "react";
import { AcademyChessboard } from "./AcademyChessboard";
import { Button } from "@/components/Button";
import { DisplayedBadge } from "@/components/DisplayedBadge";
import { formatClock } from "@/chess/game/clock";
import type { TeacherBoardPreview, TeacherLiveGameSummary } from "@/chess/live/types";
import type { ChessColor } from "@/chess/types";

const ignoreMove = () => {};

function PreviewClock({ preview, color, name }: { preview: TeacherBoardPreview; color: ChessColor; name: string }) {
  const [timing, setTiming] = useState(() => ({ now: Date.now(), offset: Date.now() - Date.parse(preview.serverNow) }));
  const base = color === "white" ? preview.clocks.whiteMs : preview.clocks.blackMs;
  const active = preview.activeColor === color;
  useEffect(() => {
    const offset = Date.now() - Date.parse(preview.serverNow);
    setTiming({ now: Date.now(), offset });
    if (!active || base === null || !preview.clocks.startedAt) return;
    const timer = window.setInterval(() => setTiming({ now: Date.now(), offset }), 250);
    return () => window.clearInterval(timer);
  }, [preview, active, base]);
  const elapsed = active && preview.clocks.startedAt ? Math.max(0, timing.now - timing.offset - Date.parse(preview.clocks.startedAt)) : 0;
  const remaining = base === null ? null : Math.max(0, base - elapsed);
  return <span aria-label={`${name} clock ${remaining === null ? "untimed" : formatClock(remaining)}`} className={`shrink-0 rounded-md border px-2 py-1 font-mono text-lg font-black tabular-nums ${active ? "border-amber-300/50 bg-amber-300/15 text-amber-100" : "border-white/10 bg-slate-950 text-slate-300"}`}>
    {remaining === null ? "Untimed" : formatClock(remaining)}
  </span>;
}

export const TeacherLiveBoardCard = memo(function TeacherLiveBoardCard({ game, slot, games, onChoose, loading }: { game: TeacherLiveGameSummary; slot: number; games: TeacherLiveGameSummary[]; onChoose: (id: string) => void; loading: boolean }) {
  const preview = game.preview;
  const player = (color: ChessColor) => <div className="flex min-w-0 items-center gap-2 py-2">
    <span aria-hidden="true" className={`size-3 shrink-0 rounded-full border border-slate-400 ${color === "white" ? "bg-white" : "bg-slate-950"}`} />
    <span className="min-w-0 flex-1 truncate text-sm font-bold text-white" title={game.players[color].name}>{game.players[color].name}</span>
    <DisplayedBadge badge={game.players[color].displayedBadge} studentId={game.players[color].id} />
    {preview && <PreviewClock preview={preview} color={color} name={game.players[color].name} />}
  </div>;
  return <article data-live-preview={game.id} aria-label={`Board ${slot}: ${game.players.white.name} vs ${game.players.black.name}`} className="min-w-0 rounded-xl border border-cyan-200/20 bg-slate-950/90 p-3 shadow-lg">
    <div className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wide">
      <h3 className="text-cyan-200">Board {slot} · {game.computerPractice ? "Computer practice" : game.arenaTournamentId ? "Tournament" : "Student game"}</h3>
      <span className="shrink-0 text-emerald-200">Live</span>
    </div>
    <label className="mt-3 block text-xs font-bold text-slate-300">
      Choose game <span className="sr-only">for board {slot}</span>
      <select value={game.id} onChange={event => onChoose(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-white/20 bg-slate-900 px-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
        {games.map(option => <option key={option.id} value={option.id}>{option.players.white.name} vs {option.players.black.name} · {option.timeControl.name}{option.computerPractice ? " · Computer" : option.arenaTournamentId ? " · Tournament" : ""}</option>)}
      </select>
    </label>
    {player("black")}
    {preview ? <AcademyChessboard boardId={`teacher-preview-${game.id}`} fen={preview.fen} orientation="white" humanColor="white" interactive={false} lastMove={preview.lastMove} onMove={ignoreMove} allowDrawingArrows />
      : <div role="status" className="grid aspect-square place-items-center rounded-lg border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-400">{loading ? "Loading board…" : "Position temporarily unavailable. Open the game or refresh to try again."}</div>}
    {player("white")}
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
      <p className="text-xs text-slate-400">{game.timeControl.name} · {preview?.activeColor === "black" ? "Black" : "White"} to move</p>
      <Button href={`/admin/live-games/${game.id}`} variant="secondary">Watch Game</Button>
    </div>
  </article>;
});
