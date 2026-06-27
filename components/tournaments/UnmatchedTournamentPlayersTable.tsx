import { Card } from "@/components/Card";
import type { ArenaTournamentResult } from "@/lib/types";

export function UnmatchedTournamentPlayersTable({ results }: { results: ArenaTournamentResult[] }) {
  const unmatched = results.filter((result) => !result.matched);
  if (unmatched.length === 0) return null;

  return (
    <Card className="border-amber-300/20 p-4">
      <h2 className="font-black text-white">Unmatched Lichess Players</h2>
      <p className="mt-1 text-sm text-slate-400">Link these usernames to students before syncing again if they should receive XP.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {unmatched.map((result) => (
          <span key={result.id} className="rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
            {result.lichessUsername} - rank {result.rank}, score {result.score}
          </span>
        ))}
      </div>
    </Card>
  );
}
