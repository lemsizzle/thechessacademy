import { BotPortrait } from "@/chess/components/BotPortrait";
import { ChessClock } from "@/chess/components/ChessClock";

export function PlayerPanel({ name, subtitle, clockMs, active, thinking, portrait, materialAdvantage }: { name: string; subtitle: string; clockMs: number | null; active: boolean; thinking?: boolean; portrait?: string; materialAdvantage?: number }) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border p-2 ${active ? "border-cyan-200/35 bg-cyan-300/8" : "border-white/10 bg-slate-950/55"}`}>
      <div className="flex min-w-0 items-center gap-2">
        {portrait ? <BotPortrait src={portrait} /> : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? "animate-pulse bg-cyan-300" : "bg-slate-600"}`} aria-hidden="true" />
            <p className="truncate font-black text-white">{name}</p>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <p className="truncate text-xs text-slate-400">{thinking ? `${name} is thinking...` : subtitle}</p>
            {materialAdvantage ? (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black tabular-nums ${materialAdvantage > 0 ? "bg-emerald-300/15 text-emerald-200" : "bg-rose-300/10 text-rose-200"}`}
                aria-label={`${name} is ${materialAdvantage > 0 ? "up" : "down"} ${Math.abs(materialAdvantage)} points of material`}
                title="Material balance"
              >
                {materialAdvantage > 0 ? "+" : "−"}{Math.abs(materialAdvantage)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <ChessClock milliseconds={clockMs} active={active} label={name} />
    </div>
  );
}
