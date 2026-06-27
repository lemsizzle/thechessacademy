import type { TournamentSource } from "@/lib/types";

const labels: Record<TournamentSource, string> = {
  team_sync: "Team Tournament",
  imported_url: "Imported Tournament",
  manual_fallback: "Manual Fallback"
};

const styles: Record<TournamentSource, string> = {
  team_sync: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  imported_url: "border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-100",
  manual_fallback: "border-amber-300/25 bg-amber-300/10 text-amber-100"
};

export function TournamentSourceBadge({ source }: { source: TournamentSource }) {
  return <span className={`rounded border px-2 py-1 text-xs font-black uppercase ${styles[source]}`}>{labels[source]}</span>;
}
