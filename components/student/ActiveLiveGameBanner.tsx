"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LiveGameSummary } from "@/chess/live/types";

export function resumableLiveGames(games: LiveGameSummary[], pathname: string) {
  return games.filter((game) => game.status === "active" && game.gameMode === "live"
    && pathname.replace(/\/$/, "") !== `/student/play/live/${game.id}`);
}

/** Discover saved games on every page, including after a refresh or a new session. */
export function ActiveLiveGameBanner() {
  const pathname = usePathname();
  const [games, setGames] = useState<LiveGameSummary[]>([]);

  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/student/live-games", {
          cache: "no-store", signal: controller.signal
        });
        if (response.status === 401) {
          if (!disposed) setGames([]);
          return;
        }
        if (!response.ok) return;
        const data = await response.json() as { games?: LiveGameSummary[] };
        if (!disposed && Array.isArray(data.games)) {
          const active = data.games.filter(game => game.status === "active" && game.gameMode === "live");
          setGames(current => JSON.stringify(current) === JSON.stringify(active) ? current : active);
        }
      } catch {
        // Keep the return link during a temporary outage; reconnect refreshes it.
      } finally {
        pending = false;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  const activeGames = resumableLiveGames(games, pathname);
  if (!activeGames.length) return null;

  return (
    <section aria-label="Your ongoing live games" className="mb-5 space-y-2">
      {activeGames.map((game) => (
        <div key={game.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/40 bg-cyan-950/70 px-4 py-3">
          <div className="min-w-0">
            <p className="font-bold text-white">{game.arenaTournamentId ? "Tournament game" : "Live game"} · vs {game.opponent?.name ?? "Opponent"}</p>
            <p role="status" className="text-sm text-cyan-100">
              {game.activeColor === game.viewerColor ? "Your move" : "Opponent’s move"} · The clock is still running
            </p>
          </div>
          <Link href={`/student/play/live/${game.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-yellow-300 px-4 py-2 font-bold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
            Return to game
          </Link>
        </div>
      ))}
    </section>
  );
}
