"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AdminTournamentNav } from "@/components/tournaments/AdminTournamentNav";
import { UnmatchedTournamentPlayersTable } from "@/components/tournaments/UnmatchedTournamentPlayersTable";
import { mockArenaTournamentResults, mockPendingTournamentAwards } from "@/data/tournamentResults";
import { students as seedStudents } from "@/data/students";
import { studentLichessAccounts as seedAccounts } from "@/data/lichessSync";
import { createPendingArenaTournamentAwards } from "@/lib/tournaments/createPendingArenaTournamentAwards";
import { matchArenaResultToStudent } from "@/lib/tournaments/matchArenaResultToStudent";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import type { ArenaTournamentResult, PendingTournamentAward, Student, StudentLichessAccount, Tournament, TournamentSource, TournamentStatus } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type TournamentResponse = { tournaments: Tournament[]; mode: "connected" | "mock"; warning?: string };

export function AdminArenaTournamentResultsTable() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [results, setResults] = useState<ArenaTournamentResult[]>([]);
  const [awards, setAwards] = useState<PendingTournamentAward[]>([]);
  const [students, setStudents] = useState<Student[]>(seedStudents);
  const [accounts, setAccounts] = useState<StudentLichessAccount[]>(seedAccounts);
  const [status, setStatus] = useState<TournamentStatus | "all">("finished");
  const [source, setSource] = useState<TournamentSource | "all">("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [tournamentFilter, setTournamentFilter] = useState("all");
  const [message, setMessage] = useState("Sync results after an Arena is finished so scores are final.");
  const [syncingId, setSyncingId] = useState("");

  useEffect(() => {
    const store = readAdminStore();
    setResults(store.arenaTournamentResults ?? mockArenaTournamentResults);
    setAwards(store.pendingTournamentAwards ?? mockPendingTournamentAwards);
    setStudents(store.students ?? seedStudents);
    setAccounts(store.studentLichessAccounts ?? seedAccounts);
    fetch("/api/lichess/team-tournaments", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: TournamentResponse) => {
        setTournaments([...data.tournaments, ...(store.importedTournaments ?? [])]);
        if (data.warning) setMessage(data.warning);
      })
      .catch(() => setMessage("Could not load Arena tournaments."));
  }, []);

  const visible = useMemo(() => tournaments.filter((tournament) => (
    (status === "all" || tournament.status === status)
    && (source === "all" || tournament.source === source)
    && (tournamentFilter === "all" || tournament.id === tournamentFilter)
  )), [source, status, tournamentFilter, tournaments]);

  async function syncResults(tournament: Tournament) {
    if (tournament.status !== "finished" || !tournament.lichessId) return;
    setSyncingId(tournament.id);
    try {
      const response = await fetch("/api/lichess/tournament-results/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: tournament.id, lichessTournamentId: tournament.lichessId, status: tournament.status, startsAt: tournament.startsAt })
      });
      const data = await response.json() as { results?: ArenaTournamentResult[]; mode?: string; warning?: string; error?: string };
      if (!response.ok || !data.results) throw new Error(data.error ?? "Results sync failed.");
      const matched = data.results.map((result) => matchArenaResultToStudent(result, students, accounts));
      const otherResults = results.filter((result) => result.lichessTournamentId !== tournament.lichessId);
      const nextResults = [...matched, ...otherResults];
      const newAwards = createPendingArenaTournamentAwards(tournament, matched, awards);
      const nextAwards = [...newAwards, ...awards];
      setResults(nextResults);
      setAwards(nextAwards);
      updateAdminStore({ arenaTournamentResults: nextResults, pendingTournamentAwards: nextAwards });
      setMessage(`${matched.length} Arena results synced. ${newAwards.length} new XP award${newAwards.length === 1 ? "" : "s"} created for review.${data.warning ? ` ${data.warning}` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sync Arena results.");
    } finally {
      setSyncingId("");
    }
  }

  return (
    <div className="space-y-5">
      <AdminTournamentNav />
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-black text-white">Arena Results Sync</h2>
            <p className="mt-1 text-sm text-slate-400">{message}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={status} onChange={(event) => setStatus(event.target.value as TournamentStatus | "all")}>
              <option value="all">All statuses</option><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="finished">Finished</option>
            </select>
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={source} onChange={(event) => setSource(event.target.value as TournamentSource | "all")}>
              <option value="all">All sources</option><option value="team_sync">Team sync</option><option value="imported_url">Imported URL</option>
            </select>
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
              <option value="all">All students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={tournamentFilter} onChange={(event) => setTournamentFilter(event.target.value)}>
              <option value="all">All tournaments</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {visible.map((tournament) => {
        const tournamentResults = results.filter((result) => (
          result.lichessTournamentId === tournament.lichessId
          && (studentFilter === "all" || result.studentId === studentFilter)
        ));
        return (
          <Card key={tournament.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-cyan-100">{tournament.status} Arena</p>
                <h2 className="mt-1 font-black text-white">{tournament.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{tournamentResults.length} imported result{tournamentResults.length === 1 ? "" : "s"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button href={tournament.url} variant="ghost">Open Lichess</Button>
                <Button onClick={() => syncResults(tournament)} disabled={tournament.status !== "finished" || syncingId === tournament.id} variant="secondary">
                  {syncingId === tournament.id ? "Syncing..." : "Sync Results"}
                </Button>
              </div>
            </div>
            {tournamentResults.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400"><tr><th className="p-2">Player</th><th className="p-2">Rank</th><th className="p-2">Score</th><th className="p-2">Rating</th><th className="p-2">Performance</th><th className="p-2">Match</th></tr></thead>
                  <tbody>
                    {tournamentResults.map((result) => (
                      <tr key={result.id} className="border-t border-white/10">
                        <td className="p-2 font-bold text-white">{result.lichessUsername}</td>
                        <td className="p-2 text-slate-300">{result.rank}</td>
                        <td className="p-2 font-black text-amber-100">{result.score}</td>
                        <td className="p-2 text-slate-300">{result.rating ?? "-"}</td>
                        <td className="p-2 text-slate-300">{result.performance ?? "-"}</td>
                        <td className={`p-2 font-bold ${result.matched ? "text-emerald-200" : "text-amber-200"}`}>{result.matched ? "Student linked" : "Unmatched"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
      <UnmatchedTournamentPlayersTable results={results} />
    </div>
  );
}
