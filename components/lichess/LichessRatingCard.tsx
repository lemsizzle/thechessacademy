import type { ReactNode } from "react";

type LichessRatingCardProps = {
  label: "Blitz" | "Rapid" | "Puzzle" | "Arena Points";
  rating: number | null;
  games: number;
  change?: number | null;
  provisional?: boolean;
  icon?: ReactNode;
};

export function LichessRatingCard({ label, rating, games, change = null, provisional = false, icon }: LichessRatingCardProps) {
  const changeText = change === null ? "No change" : `${change > 0 ? "+" : ""}${change}`;
  const gamesLabel = label === "Puzzle" ? "puzzles" : label === "Arena Points" ? "tournaments" : "rated games";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase text-slate-400">{label}</p>
        <span className="text-sm font-black text-cyan-100">{icon ?? label.slice(0, 1)}</span>
      </div>
      <p className="mt-2 text-2xl font-black text-white">{rating ?? "Unrated"}</p>
      <p className="mt-1 text-xs font-bold text-slate-300">{games.toLocaleString()} {gamesLabel}</p>
      {label !== "Puzzle" && label !== "Arena Points" && (
        <p className={`mt-1 text-xs font-bold ${change !== null && change >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
          {changeText}{provisional ? " - provisional" : ""}
        </p>
      )}
    </div>
  );
}
