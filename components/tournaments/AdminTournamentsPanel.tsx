"use client";

import { ManualTournamentForm } from "@/components/tournaments/ManualTournamentForm";
import { AdminTournamentNav } from "@/components/tournaments/AdminTournamentNav";
import { AdminArenaTournamentsTable } from "@/components/tournaments/AdminArenaTournamentsTable";
import { ImportArenaTournamentForm } from "@/components/tournaments/ImportArenaTournamentForm";
import { TournamentSyncPanel } from "@/components/tournaments/TournamentSyncPanel";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { sortTournaments } from "@/lib/tournaments/sortTournaments";
import { getManualArenaTournaments } from "@/lib/tournaments/getManualArenaTournaments";
import type { Tournament } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type TournamentsResponse = {
  tournaments: Tournament[];
  teamId: string;
  syncedAt: string;
  mode: "connected" | "mock";
  warning?: string;
  createdBy?: string;
};

function saveManualTournaments(tournaments: Tournament[]) {
  updateAdminStore({ manualTournaments: tournaments });
}

export function AdminTournamentsPanel() {
  const [data, setData] = useState<TournamentsResponse | undefined>();
  const [manual, setManual] = useState<Tournament[]>([]);
  const [imported, setImported] = useState<Tournament[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const tournaments = useMemo(() => sortTournaments([...(data?.tournaments ?? []), ...imported, ...manual]), [data?.tournaments, imported, manual]);

  function loadTournaments() {
    fetch("/api/lichess/team-tournaments", { cache: "no-store" })
      .then((response) => response.json())
      .then((next: TournamentsResponse) => setData(next))
      .catch(() => setData({
        tournaments: [],
        teamId: "outschool-battleground",
        syncedAt: new Date().toISOString(),
        mode: "mock",
        warning: "Could not load tournament data."
      }));
  }

  useEffect(() => {
    setManual(getManualArenaTournaments(readAdminStore().manualTournaments));
    setImported(readAdminStore().importedTournaments ?? []);
    loadTournaments();
  }, []);

  function addManual(tournament: Tournament) {
    const next = [tournament, ...manual];
    setManual(next);
    saveManualTournaments(next);
  }

  function addImported(tournament: Tournament) {
    if (data?.tournaments.some((item) => item.lichessId?.toLowerCase() === tournament.lichessId?.toLowerCase())) return;
    const next = [tournament, ...imported.filter((item) => item.lichessId !== tournament.lichessId)];
    setImported(next);
    updateAdminStore({ importedTournaments: next });
  }

  async function syncNow() {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/lichess/team-tournaments/sync", { method: "POST" });
      setData(await response.json() as TournamentsResponse);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminTournamentNav />
      <TournamentSyncPanel
        teamId={data?.teamId ?? "outschool-battleground"}
        mode={data?.mode}
        syncedAt={data?.syncedAt}
        warning={data?.warning}
        isSyncing={isSyncing}
        onSync={syncNow}
      />
      <ImportArenaTournamentForm existingTournaments={tournaments} onImport={addImported} disabled={!data} />
      <ManualTournamentForm onAdd={addManual} />
      <AdminArenaTournamentsTable tournaments={tournaments} onImportedChange={setImported} />
    </div>
  );
}
