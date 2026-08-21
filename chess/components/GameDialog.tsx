"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/Button";

export function GameDialog({ title, description, children, primaryLabel, onPrimary, secondaryLabel, onSecondary }: {
  title: string;
  description: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation">
      <section className="w-full max-w-md rounded-xl border border-cyan-200/25 bg-slate-950 p-6 shadow-[0_0_60px_rgba(34,211,238,.2)]" role="dialog" aria-modal="true" aria-labelledby="game-dialog-title">
        <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Chess Academy</p>
        <h2 id="game-dialog-title" className="mt-2 text-2xl font-black text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
        {children}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {secondaryLabel && onSecondary && <Button type="button" variant="ghost" onClick={onSecondary}>{secondaryLabel}</Button>}
          <Button type="button" onClick={onPrimary}>{primaryLabel}</Button>
        </div>
      </section>
    </div>
  );
}
