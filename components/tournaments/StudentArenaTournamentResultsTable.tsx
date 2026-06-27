"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TournamentSourceBadge } from "@/components/tournaments/TournamentSourceBadge";
import { mockArenaTournamentResults, mockPendingTournamentAwards } from "@/data/tournamentResults";
import { getCurrentStudentUser } from "@/lib/auth/getCurrentUser";
import { readAdminStore } from "@/lib/mockStorage";
import { useEffect, useState } from "react";
import type { ArenaTournamentResult, PendingTournamentAward } from "@/lib/types";

export function StudentArenaTournamentResultsTable() {
  const [results, setResults] = useState<ArenaTournamentResult[]>([]);
  const [awards, setAwards] = useState<PendingTournamentAward[]>([]);

  useEffect(() => {
    const user = getCurrentStudentUser();
    const store = readAdminStore();
    setResults((store.arenaTournamentResults ?? mockArenaTournamentResults).filter((result) => result.studentId === user?.studentId));
    setAwards((store.pendingTournamentAwards ?? mockPendingTournamentAwards).filter((award) => award.studentId === user?.studentId));
  }, []);

  if (results.length === 0) return null;
  return (
    <Card className="p-4">
      <h2 className="font-black text-white">My Recent Arena Results</h2>
      <div className="mt-3 space-y-3">
        {results.slice(0, 6).map((result) => {
          const award = awards.find((item) => item.lichessTournamentId === result.lichessTournamentId);
          return (
            <div key={result.id} className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-white">Rank {result.rank} - {result.score} Arena points</p>
                  {award?.tournamentSource && <TournamentSourceBadge source={award.tournamentSource} />}
                </div>
                <p className="mt-1 text-xs text-slate-400">Rating {result.rating ?? "not listed"} - Performance {result.performance ?? "not listed"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-1 text-xs font-black uppercase ${award?.status === "approved" ? "bg-emerald-300/15 text-emerald-100" : award?.status === "rejected" ? "bg-rose-300/15 text-rose-100" : "bg-amber-300/15 text-amber-100"}`}>
                  {award?.status === "approved" ? `${award.xpAmount} XP approved` : award?.status === "rejected" ? "XP not awarded" : `${award?.xpAmount ?? 0} XP pending`}
                </span>
                <Button href={`https://lichess.org/tournament/${result.lichessTournamentId}`} variant="ghost">Open</Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
