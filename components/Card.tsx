import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-white/10 bg-slate-950/58 shadow-glow backdrop-blur ${className}`}>{children}</section>;
}
