"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TournamentList } from "@/components/tournaments/TournamentList";
import { StudentArenaTournamentResultsTable } from "@/components/tournaments/StudentArenaTournamentResultsTable";
import { readAdminStore } from "@/lib/mockStorage";
import { getManualArenaTournaments } from "@/lib/tournaments/getManualArenaTournaments";
import { getCurrentStudentUser } from "@/lib/auth/getCurrentUser";
import type { Tournament } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type TournamentsResponse = {
  tournaments: Tournament[];
  teamId: string;
  syncedAt: string;
  mode: "connected" | "mock";
  warning?: string;
};

function readManualTournaments() {
  return getManualArenaTournaments(readAdminStore().manualTournaments);
}

export function TournamentsBoard({ studentView = false }: { studentView?: boolean }) {
  const [data, setData] = useState<TournamentsResponse | undefined>();
  const [manual, setManual] = useState<Tournament[]>([]);
  const [imported, setImported] = useState<Tournament[]>([]);
  const [error, setError] = useState("");
  const teamId = data?.teamId ?? "outschool-battleground";
  const teamUrl = `https://lichess.org/team/${teamId}`;

  useEffect(() => {
    const store = readAdminStore();
    setManual(readManualTournaments().filter((tournament) => tournament.isActive !== false && tournament.isPublic !== false));
    const user = getCurrentStudentUser();
    const relevantIds = new Set((store.arenaTournamentResults ?? []).filter((result) => result.studentId === user?.studentId).map((result) => result.lichessTournamentId));
    setImported((store.importedTournaments ?? []).filter((tournament) => (
      tournament.isActive !== false
      && (tournament.isPublic === true || (studentView && relevantIds.has(tournament.lichessId ?? "")))
    )));
    fetch("/api/lichess/team-tournaments", { cache: "no-store" })
      .then((response) => response.json())
      .then((next: TournamentsResponse) => setData(next))
      .catch(() => setError("Could not load tournaments. Showing manual fallback if available."));
  }, []);

  const tournaments = useMemo(() => [...(data?.tournaments ?? []), ...imported, ...manual], [data?.tournaments, imported, manual]);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-cyan-100">Lichess Team</p>
            <h2 className="mt-1 font-black text-white">{teamId}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {studentView ? "Upcoming and ongoing tournaments from our team page." : "Upcoming and ongoing tournaments from the Chess Academy Lichess team."}
            </p>
            {(data?.warning || error) && <p className="mt-2 text-sm font-bold text-amber-100">{data?.warning || error}</p>}
          </div>
          <Button href={teamUrl} variant="ghost">Open Team</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase text-amber-100">Join Before You Play</p>
            <h2 className="mt-1 font-black text-white">How To Join The Chess Academy Team</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-300">
              <li><span className="font-black text-cyan-100">1.</span> Log in to Lichess with the account you use for class.</li>
              <li><span className="font-black text-cyan-100">2.</span> Open the Chess Academy team page and click join.</li>
              <li><span className="font-black text-cyan-100">3.</span> When Lichess asks for the entry code, type <span className="font-black text-amber-100">good game</span>.</li>
              <li><span className="font-black text-cyan-100">4.</span> Return here and choose an upcoming tournament to join.</li>
            </ol>
          </div>
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-center">
            <p className="text-xs font-black uppercase text-amber-100">Team Entry Code</p>
            <p className="mt-1 text-2xl font-black text-white">good game</p>
            <Button href={teamUrl} variant="secondary" className="mt-4 w-full">Join Team</Button>
          </div>
        </div>
      </Card>
      <TournamentList tournaments={tournaments} upcomingOnly={!studentView} />
      {studentView && <StudentArenaTournamentResultsTable />}
    </div>
  );
}
