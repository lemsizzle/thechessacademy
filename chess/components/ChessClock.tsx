import { formatClock } from "@/chess/game/clock";

export function ChessClock({ milliseconds, active, label }: { milliseconds: number | null; active: boolean; label: string }) {
  return (
    <div className={`min-w-24 shrink-0 rounded-md border px-2 py-1.5 text-right font-mono transition ${active ? "border-amber-300/70 bg-amber-300/15 text-amber-100 shadow-gold" : "border-white/10 bg-slate-950/80 text-slate-200"}`} aria-label={`${label} clock ${formatClock(milliseconds)}`}>
      <span className="block text-[10px] font-black uppercase tracking-wider opacity-70">{label}</span>
      <span className="block text-xl font-black tabular-nums">{formatClock(milliseconds)}</span>
    </div>
  );
}
