"use client";

import { Button } from "@/components/Button";

export function BattlefieldCinematicHook({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/90 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="battlefield-hook-title">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-200/45 bg-gradient-to-br from-amber-300/15 via-slate-950 to-cyan-300/10 p-7 text-center shadow-[0_0_80px_rgba(250,204,21,.18)]">
        <p className="text-xs font-black uppercase tracking-[0.32em] text-amber-200">Battlefield cinematic hook</p>
        <h2 id="battlefield-hook-title" className="mt-3 text-3xl font-black text-white">CHECKMATE!</h2>
        <p className="mt-3 text-sm leading-6 text-slate-200">The 2D board has confirmed the win. Final battle animation, character art, sound, and camera work plug in here later.</p>
        <div className="mx-auto mt-6 grid h-32 max-w-sm place-items-center rounded-xl border border-dashed border-white/25 bg-slate-900/70 text-xs font-bold uppercase tracking-wider text-cyan-100">Placeholder battlefield shot</div>
        <Button type="button" className="mt-6" onClick={onDismiss}>Return to the board</Button>
      </div>
    </div>
  );
}
