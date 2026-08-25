"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeacherLiveGameSummary } from "@/chess/live/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

type ListResponse = { ok?: boolean; games?: TeacherLiveGameSummary[]; error?: string };

export function AdminLiveGames({ initialGames }: { initialGames: TeacherLiveGameSummary[] }) {
  const [games, setGames] = useState(initialGames);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async (showProgress = false) => {
    if (showProgress) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/live-games", { cache: "no-store" });
      const body = await response.json() as ListResponse;
      if (!response.ok || !body.games) throw new Error(body.error || "Live games could not be loaded.");
      setGames(body.games);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Live games could not be loaded.");
    } finally {
      if (showProgress) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-300" aria-live="polite">{games.length} game{games.length === 1 ? "" : "s"} currently in progress</p>
        <Button type="button" variant="ghost" disabled={refreshing} onClick={() => void refresh(true)}>{refreshing ? "Refreshing..." : "Refresh"}</Button>
      </div>
      {message ? <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100" role="alert">{message}</p> : null}
      {games.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {games.map((game) => (
            <Card key={game.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-cyan-200">{game.matchmaking ? "Academy match" : "Private challenge"} · {game.rated ? "Rated" : "Casual"}</p>
                  <h2 className="mt-2 truncate text-xl font-black text-white">{game.players.white.name} vs {game.players.black.name}</h2>
                  <p className="mt-2 text-sm font-bold text-slate-300"><span className="text-slate-500">White:</span> {game.players.white.name}</p>
                  <p className="mt-1 text-sm font-bold text-slate-300"><span className="text-slate-500">Black:</span> {game.players.black.name}</p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2 py-1 text-[11px] font-black uppercase text-emerald-100">Live</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <p className="text-xs font-bold text-slate-400">{game.timeControl.name} · {game.moveCount} move{game.moveCount === 1 ? "" : "s"} · {game.players[game.activeColor].name} to move</p>
                <Button href={`/admin/live-games/${game.id}`}>Watch Game</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No games in progress" message="Active student-vs-student games will appear here automatically." />}
    </div>
  );
}
