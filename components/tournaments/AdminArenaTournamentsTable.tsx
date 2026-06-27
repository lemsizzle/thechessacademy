"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TournamentSourceBadge } from "@/components/tournaments/TournamentSourceBadge";
import { mockPendingTournamentAwards } from "@/data/tournamentResults";
import { students as seedStudents } from "@/data/students";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { createPendingArenaTournamentAwards } from "@/lib/tournaments/createPendingArenaTournamentAwards";
import { matchArenaResultToStudent } from "@/lib/tournaments/matchArenaResultToStudent";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import type { ArenaTournamentResult, PendingTournamentAward, Student, StudentLichessAccount, Tournament, TournamentSource, TournamentStatus } from "@/lib/types";
import { useMemo, useState } from "react";

export function AdminArenaTournamentsTable({
  tournaments,
  onImportedChange
}: {
  tournaments: Tournament[];
  onImportedChange: (tournaments: Tournament[]) => void;
}) {
  const [source, setSource] = useState<TournamentSource | "all">("all");
  const [status, setStatus] = useState<TournamentStatus | "all">("all");
  const [syncingId, setSyncingId] = useState("");
  const [message, setMessage] = useState("Finished Arenas can sync standings into the XP approval queue.");
  const visible = useMemo(() => tournaments.filter((tournament) => (
    (source === "all" || tournament.source === source) && (status === "all" || tournament.status === status)
  )), [source, status, tournaments]);

  function updateImported(tournamentId: string, patch: Partial<Tournament>) {
    const imported = (readAdminStore().importedTournaments ?? []).map((tournament) => tournament.id === tournamentId ? { ...tournament, ...patch } : tournament);
    updateAdminStore({ importedTournaments: imported });
    onImportedChange(imported);
  }

  async function syncResults(tournament: Tournament) {
    if (!tournament.lichessId || tournament.status !== "finished") return;
    setSyncingId(tournament.id);
    try {
      const response = await fetch("/api/lichess/tournament-results/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: tournament.id, lichessTournamentId: tournament.lichessId, status: tournament.status, startsAt: tournament.startsAt })
      });
      const data = await response.json() as { results?: ArenaTournamentResult[]; warning?: string; error?: string };
      if (!response.ok || !data.results) throw new Error(data.error ?? "Results sync failed.");
      const store = readAdminStore();
      const students: Student[] = store.students ?? seedStudents;
      const accounts: StudentLichessAccount[] = store.studentLichessAccounts ?? seedAccounts;
      const existingResults = store.arenaTournamentResults ?? [];
      const existingAwards: PendingTournamentAward[] = store.pendingTournamentAwards ?? mockPendingTournamentAwards;
      const matched = data.results.map((result) => matchArenaResultToStudent(result, students, accounts));
      const nextResults = [...matched, ...existingResults.filter((result) => result.lichessTournamentId !== tournament.lichessId)];
      const newAwards = createPendingArenaTournamentAwards(tournament, matched, existingAwards);
      updateAdminStore({ arenaTournamentResults: nextResults, pendingTournamentAwards: [...newAwards, ...existingAwards] });
      setMessage(`${matched.length} results synced for ${tournament.name}; ${newAwards.length} new XP award${newAwards.length === 1 ? "" : "s"} await approval.${data.warning ? ` ${data.warning}` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sync Arena results.");
    } finally {
      setSyncingId("");
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-black text-white">All Arena Tournaments</h2>
          <p className="mt-1 text-sm text-slate-400">{message}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={source} onChange={(event) => setSource(event.target.value as TournamentSource | "all")}>
            <option value="all">All sources</option>
            <option value="team_sync">Team sync</option>
            <option value="imported_url">Imported URL</option>
            <option value="manual_fallback">Manual fallback</option>
          </select>
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={status} onChange={(event) => setStatus(event.target.value as TournamentStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="finished">Finished</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {visible.map((tournament) => (
          <div key={tournament.id} className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <TournamentSourceBadge source={tournament.source} />
                <span className="text-xs font-black uppercase text-slate-400">{tournament.status}</span>
                {tournament.source === "imported_url" && <span className="text-xs font-bold text-slate-400">{tournament.isPublic ? "Public" : "Admin only"}</span>}
              </div>
              <p className="mt-2 font-black text-white">{tournament.name}</p>
              <p className="mt-1 text-xs text-slate-400">Lichess ID: {tournament.lichessId ?? "manual fallback"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tournament.source === "imported_url" && (
                <Button variant="ghost" onClick={() => updateImported(tournament.id, { isPublic: !tournament.isPublic })}>
                  {tournament.isPublic ? "Make Private" : "Make Public"}
                </Button>
              )}
              <Button href={tournament.url} variant="ghost">Open Lichess</Button>
              <Button variant="secondary" disabled={!tournament.lichessId || tournament.status !== "finished" || syncingId === tournament.id} onClick={() => syncResults(tournament)}>
                {syncingId === tournament.id ? "Syncing..." : "Sync Results"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
