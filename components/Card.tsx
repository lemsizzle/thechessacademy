import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-white/10 bg-slate-950/90 shadow-[0_14px_38px_rgba(2,6,23,.28)] ${className}`}>{children}</section>;
}
