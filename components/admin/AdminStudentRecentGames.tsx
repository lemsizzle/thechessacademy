"use client";

import { useEffect, useState } from "react";
import type { RecentStudentGames } from "@/chess/history/types";
import { Button } from "@/components/Button";

export function AdminStudentRecentGames({ studentId, studentName, actionToken }: { studentId: string; studentName: string; actionToken?: string }) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<RecentStudentGames | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    fetch(`/api/admin/students/${encodeURIComponent(studentId)}/games?page=${page}`, {
      cache: "no-store", signal: controller.signal,
      headers: actionToken ? { "x-admin-action-token": actionToken } : {}
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load recent games.");
      if (!controller.signal.aborted) setData(body);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load recent games.");
    });
    return () => controller.abort();
  }, [studentId, actionToken, page, refresh]);

  return <section className="mt-4 rounded-lg border border-cyan-300/20 bg-black/20 p-4" aria-label="Student recent games">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-black text-white">Recent games · {studentName}</h3>
        <p className="mt-1 text-sm text-slate-400">Completed Chess Quest games, including bots, live games, and tournaments. Results are from this student’s perspective.</p></div>
      <Button variant="ghost" onClick={() => setRefresh((value) => value + 1)}>Refresh games</Button>
    </div>
    <div className="mt-3" aria-live="polite">
      {error ? <p role="alert" className="text-sm text-rose-200">{error} <Button variant="ghost" onClick={() => setRefresh((value) => value + 1)}>Retry</Button></p>
        : !data ? <p className="text-sm text-slate-300">Loading recent games…</p>
        : !data.games.length ? <p className="text-sm text-slate-300">No completed games on this page yet.</p>
        : <ul className="divide-y divide-white/10">{data.games.map((game) => <li key={game.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="font-bold text-white"><span className={game.result === "win" ? "text-emerald-300" : game.result === "loss" ? "text-rose-200" : "text-amber-200"}>{game.result === "win" ? "Win" : game.result === "loss" ? "Loss" : "Draw"}</span> · vs {game.opponentName}</p>
            <p className="text-xs text-slate-400">{new Date(game.completedAt).toLocaleString()} · {game.playerColor} · {game.gameMode === "correspondence" ? "Correspondence" : game.opponentType === "computer" ? "Bot" : "Live"}{game.timeControl.name ? ` · ${game.timeControl.name}` : ""} · {game.resultReason.replaceAll("_", " ")}</p></div>
          <Button variant="secondary" href={`/admin/play/game/${encodeURIComponent(game.id)}/analysis`}>Open analysis</Button>
        </li>)}</ul>}
    </div>
    {(page > 1 || data?.hasMore) && <div className="mt-3 flex items-center gap-3">
      <Button variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Newer</Button>
      <span className="text-sm text-slate-400">Page {page}</span>
      <Button variant="ghost" disabled={!data?.hasMore} onClick={() => setPage(page + 1)}>Older</Button>
    </div>}
  </section>;
}
