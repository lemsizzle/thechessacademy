"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { useGameDialogFocus } from "@/chess/hooks/useGameDialogFocus";

export function GameDialog({ title, description, children, primaryLabel, primaryDisabled = false, onPrimary, secondaryLabel, onSecondary, tone = "default", inline = false }: {
  inline?: boolean;
  tone?: "default" | "loss";
  title: string;
  description: string;
  children?: ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const dialogRef = useGameDialogFocus(onSecondary, !inline);
  return (
    <div className={inline ? "min-w-0" : "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"} role="presentation">
      <section ref={dialogRef} tabIndex={-1} className={`${inline ? "w-full" : "max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto"} rounded-xl border bg-slate-950 p-6 ${tone === "loss" ? "border-indigo-200/30 shadow-[0_0_60px_rgba(99,102,241,.15)]" : "border-cyan-200/25 shadow-[0_0_60px_rgba(34,211,238,.2)]"}`} role={inline ? "region" : "dialog"} aria-modal={inline ? undefined : true} aria-labelledby={inline ? "game-result-title" : "game-dialog-title"}>
        <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Chess Academy</p>
        <h2 id={inline ? "game-result-title" : "game-dialog-title"} aria-live={inline ? "polite" : undefined} className="mt-2 text-2xl font-black text-white">{tone === "loss" && <span aria-hidden="true" className="mr-2 text-indigo-200">☹</span>}{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
        {tone === "loss" && <p className="mt-3 text-sm leading-6 text-indigo-200">Losing can feel tough. Take your time—there’s something to learn from every game.</p>}
        {children}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {secondaryLabel && onSecondary && <Button type="button" variant="ghost" onClick={onSecondary}>{secondaryLabel}</Button>}
          <Button type="button" disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</Button>
        </div>
      </section>
    </div>
  );
}
