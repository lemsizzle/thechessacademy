"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LichessRatingCard } from "@/components/lichess/LichessRatingCard";
import { LichessXpSummary } from "@/components/lichess/LichessXpSummary";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { mockArenaTournamentResults } from "@/data/tournamentResults";
import { readAdminStore } from "@/lib/mockStorage";
import { getStudentArenaPoints } from "@/lib/tournaments/getStudentArenaPoints";
import type { Student, StudentLichessAccount } from "@/lib/types";
import { useEffect, useState } from "react";

export function LichessRatingsSummary({ student, compact = false, profileBasePath = "/app/students" }: { student: Student; compact?: boolean; profileBasePath?: string }) {
  const [account, setAccount] = useState<StudentLichessAccount | undefined>();
  const [arenaPoints, setArenaPoints] = useState({ totalPoints: 0, tournamentsPlayed: 0 });

  useEffect(() => {
    const store = readAdminStore();
    const accounts = store.studentLichessAccounts ?? seedAccounts;
    const nextAccount = accounts.find((item) => item.studentId === student.id);
    setAccount(nextAccount);
    setArenaPoints(getStudentArenaPoints(nextAccount, store.arenaTournamentResults ?? mockArenaTournamentResults));
  }, [student.id]);

  if (!account) {
    return (
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-white">Lichess Ratings</h2>
            <p className="text-sm text-slate-300">No Blitz, Rapid, or Puzzle ratings synced yet.</p>
          </div>
          <Button href={`${profileBasePath}/${student.slug}/lichess`} variant="secondary">Open Lichess</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-black text-white">Lichess Ratings</h2>
          <p className="text-sm text-slate-300">
            {account.lichessUsername} - {account.syncStatus} - Last synced {account.lastRatingSyncAt ?? "not yet"}
          </p>
        </div>
        {!compact && <Button href={account.lichessProfileUrl} target="_blank" rel="noreferrer" variant="ghost">Open Lichess</Button>}
        {compact && <Button href={`${profileBasePath}/${student.slug}/lichess`} variant="secondary">Details</Button>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LichessRatingCard label="Blitz" rating={account.blitzRating} games={account.blitzGames} change={account.blitzRatingChange} provisional={account.blitzProvisional} />
        <LichessRatingCard label="Rapid" rating={account.rapidRating} games={account.rapidGames} change={account.rapidRatingChange} provisional={account.rapidProvisional} />
        <LichessRatingCard label="Puzzle" rating={account.puzzleRating ?? null} games={account.puzzleGames ?? 0} />
        <LichessRatingCard label="Arena Points" rating={arenaPoints.totalPoints} games={arenaPoints.tournamentsPlayed} />
      </div>
      <div className="mt-3">
        <LichessXpSummary account={account} />
      </div>
    </Card>
  );
}
