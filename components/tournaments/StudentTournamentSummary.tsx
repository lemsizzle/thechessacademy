"use client";

import { Card } from "@/components/Card";
import { mockArenaTournamentResults, mockPendingTournamentAwards } from "@/data/tournamentResults";
import { readAdminStore } from "@/lib/mockStorage";
import type { Student } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function StudentTournamentSummary({ student }: { student: Student }) {
  const [loaded, setLoaded] = useState(false);
  const [results, setResults] = useState(mockArenaTournamentResults.filter((result) => result.studentId === student.id));
  const [awards, setAwards] = useState(mockPendingTournamentAwards.filter((award) => award.studentId === student.id));

  useEffect(() => {
    const store = readAdminStore();
    setResults((store.arenaTournamentResults ?? mockArenaTournamentResults).filter((result) => result.studentId === student.id));
    setAwards((store.pendingTournamentAwards ?? mockPendingTournamentAwards).filter((award) => award.studentId === student.id));
    setLoaded(true);
  }, [student.id]);

  const latest = results[0];
  const best = useMemo(() => [...results].sort((a, b) => a.rank - b.rank || b.score - a.score)[0], [results]);
  const approvedXp = awards.filter((award) => award.status === "approved").reduce((total, award) => total + award.xpAmount, 0);
  if (!loaded || results.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="font-black text-white">Arena Tournaments</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-slate-400">Played</p><p className="font-black text-white">{results.length}</p></div>
        <div><p className="text-xs text-slate-400">Latest Score</p><p className="font-black text-white">{latest?.score ?? 0}</p></div>
        <div><p className="text-xs text-slate-400">Best Rank</p><p className="font-black text-white">{best ? `#${best.rank}` : "-"}</p></div>
        <div><p className="text-xs text-slate-400">Approved XP</p><p className="font-black text-emerald-100">{approvedXp}</p></div>
      </div>
    </Card>
  );
}
