"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { GameMove } from "@/chess/types";

type Props = {
  moves: GameMove[];
  selectedPly?: number;
  onSelectPly?: (ply: number) => void;
};

function MoveCell({ move, selected, onSelect, selectedMoveRef }: {
  move?: GameMove;
  selected: boolean;
  onSelect?: (ply: number) => void;
  selectedMoveRef: RefObject<HTMLButtonElement | null>;
}) {
  if (!move) return <span />;
  if (!onSelect) return <span className="font-bold text-slate-100">{move.san}</span>;

  return (
    <button
      ref={selected ? selectedMoveRef : undefined}
      type="button"
      className={`rounded px-2 py-1 text-left font-bold transition ${selected ? "bg-cyan-300/20 text-cyan-100 ring-1 ring-cyan-200/40" : "text-slate-100 hover:bg-white/10"}`}
      aria-pressed={selected}
      aria-label={`View position after ${move.color} played ${move.san}`}
      onClick={() => onSelect(move.ply)}
    >
      {move.san}
    </button>
  );
}

export function MoveHistory({ moves, selectedPly, onSelectPly }: Props) {
  const historyRef = useRef<HTMLDivElement>(null);
  const selectedMoveRef = useRef<HTMLButtonElement>(null);
  const rows: Array<{ number: number; white?: GameMove; black?: GameMove }> = [];
  for (const move of moves) {
    const number = Math.ceil(move.ply / 2);
    rows[number - 1] ??= { number };
    if (move.color === "white") rows[number - 1].white = move;
    else rows[number - 1].black = move;
  }

  useEffect(() => {
    const history = historyRef.current;
    const selectedMove = selectedMoveRef.current;
    if (!history || !selectedMove) return;
    const historyBounds = history.getBoundingClientRect();
    const moveBounds = selectedMove.getBoundingClientRect();
    if (moveBounds.top < historyBounds.top) history.scrollTop -= historyBounds.top - moveBounds.top;
    else if (moveBounds.bottom > historyBounds.bottom) history.scrollTop += moveBounds.bottom - historyBounds.bottom;
  }, [selectedPly]);

  return (
    <div ref={historyRef} className="scrollbar-soft max-h-64 overflow-y-auto rounded-md border border-white/10 bg-slate-950/65" aria-label="Move history">
      {rows.length ? (
        <>
          {onSelectPly ? (
            <button
              ref={selectedPly === 0 ? selectedMoveRef : undefined}
              type="button"
              className={`m-2 rounded px-2 py-1 text-xs font-bold transition ${selectedPly === 0 ? "bg-cyan-300/20 text-cyan-100 ring-1 ring-cyan-200/40" : "text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}
              aria-pressed={selectedPly === 0}
              onClick={() => onSelectPly(0)}
            >
              Starting position
            </button>
          ) : null}
          <ol className="divide-y divide-white/5 text-sm">
            {rows.map((row) => (
              <li key={row.number} className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 px-3 py-2">
                <span className="text-slate-500">{row.number}.</span>
                <MoveCell move={row.white} selected={selectedPly === row.white?.ply} onSelect={onSelectPly} selectedMoveRef={selectedMoveRef} />
                <MoveCell move={row.black} selected={selectedPly === row.black?.ply} onSelect={onSelectPly} selectedMoveRef={selectedMoveRef} />
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="p-4 text-sm text-slate-500">Moves will appear here in chess notation.</p>
      )}
    </div>
  );
}
