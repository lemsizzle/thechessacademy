import type { TournamentStatus } from "@/lib/types";

const styles: Record<TournamentStatus, string> = {
  upcoming: "border-cyan-200/40 bg-cyan-300/10 text-cyan-50",
  ongoing: "border-emerald-200/40 bg-emerald-300/10 text-emerald-50",
  finished: "border-slate-300/25 bg-white/5 text-slate-300",
  unknown: "border-amber-200/35 bg-amber-300/10 text-amber-50"
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span className={`rounded border px-2 py-1 text-xs font-black uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}
