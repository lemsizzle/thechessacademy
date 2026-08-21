import { ChessClock } from "@/chess/components/ChessClock";

export function PlayerPanel({ name, subtitle, clockMs, active, thinking }: { name: string; subtitle: string; clockMs: number | null; active: boolean; thinking?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border p-2 ${active ? "border-cyan-200/35 bg-cyan-300/8" : "border-white/10 bg-slate-950/55"}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? "animate-pulse bg-cyan-300" : "bg-slate-600"}`} aria-hidden="true" />
          <p className="truncate font-black text-white">{name}</p>
        </div>
        <p className="mt-1 truncate text-xs text-slate-400">{thinking ? `${name} is thinking...` : subtitle}</p>
      </div>
      <ChessClock milliseconds={clockMs} active={active} label={name} />
    </div>
  );
}
