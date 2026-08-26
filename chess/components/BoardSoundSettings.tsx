"use client";

import { useEffect, useId, useRef, useState } from "react";

export function BoardSoundSettings({ muted, onToggleMuted }: { muted: boolean; onToggleMuted: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex justify-end">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-slate-950/80 text-lg text-slate-200 shadow-lg transition hover:border-cyan-200/30 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
        aria-label="Game sound settings"
        aria-expanded={open}
        aria-controls={settingsId}
        onClick={() => setOpen((value) => !value)}
      >
        ⚙️
      </button>
      {open ? (
        <div id={settingsId} className="absolute right-0 top-11 z-30 w-56 rounded-lg border border-white/15 bg-slate-950 p-3 text-left shadow-2xl" role="group" aria-label="Game sound settings">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Game sounds</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Move sounds and the game-over cue.</p>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
            aria-pressed={!muted}
            onClick={onToggleMuted}
          >
            <span>{muted ? "Sounds muted" : "Sounds on"}</span>
            <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
