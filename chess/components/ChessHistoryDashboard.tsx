"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  ChessHistoryGame,
  ChessHistoryMode,
  ChessHistoryPage,
  ChessHistoryResult,
  ChessHistorySummary
} from "@/chess/history/types";

const EMPTY_SUMMARY: ChessHistorySummary = {
  total: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  winRate: 0,
  computerGames: 0,
  liveGames: 0
};

const RESULT_STYLES = {
  win: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  draw: "border-slate-300/30 bg-slate-300/10 text-slate-100",
  loss: "border-rose-300/30 bg-rose-300/10 text-rose-100"
} as const;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatTimeControl(game: ChessHistoryGame) {
  if (game.gameMode === "correspondence") return "3 days per move";
  if (game.timeControl.name) return game.timeControl.name;
  const initial = game.timeControl.initialSeconds;
  const increment = game.timeControl.incrementSeconds;
  if (typeof initial === "number") return `${Math.round(initial / 60)}+${increment ?? 0}`;
  return game.opponentType === "computer" ? "No clock" : "Live game";
}

function formatOpponentType(game: ChessHistoryGame) {
  if (game.opponentType === "computer") return "Computer";
  return game.gameMode === "correspondence" ? "Correspondence" : "Live classmate";
}

function formatReason(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function SummaryCard({ label, value, tone = "text-white" }: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <Card className="min-w-0 p-3 sm:p-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
    </Card>
  );
}

export function ChessHistoryDashboard() {
  const [mode, setMode] = useState<ChessHistoryMode>("all");
  const [result, setResult] = useState<ChessHistoryResult>("all");
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [data, setData] = useState<ChessHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ mode, result, page: String(page) });
    setLoading(true);
    setError("");

    fetch(`/api/student/chess-history?${query}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as ChessHistoryPage & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Chess history could not be loaded.");
        return body;
      })
      .then((body) => setData(body))
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Chess history could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [mode, result, page, retryKey]);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const pagination = data?.pagination;

  function changeMode(nextMode: ChessHistoryMode) {
    setMode(nextMode);
    setPage(1);
  }

  function changeResult(nextResult: ChessHistoryResult) {
    setResult(nextResult);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Games" value={summary.total} />
        <SummaryCard label="Wins" value={summary.wins} tone="text-emerald-200" />
        <SummaryCard label="Draws / losses" value={`${summary.draws} / ${summary.losses}`} />
        <SummaryCard label="Win rate" value={`${summary.winRate}%`} tone="text-amber-200" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Completed games</p>
              <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Your game record</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <label className="text-xs font-bold text-slate-300">
                Opponent
                <select
                  aria-label="Filter by opponent type"
                  className="mt-1 block w-full min-w-36 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                  value={mode}
                  onChange={(event) => changeMode(event.target.value as ChessHistoryMode)}
                >
                  <option value="all">All games</option>
                  <option value="computer">Computer</option>
                  <option value="student">Classmate</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-300">
                Result
                <select
                  aria-label="Filter by game result"
                  className="mt-1 block w-full min-w-32 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                  value={result}
                  onChange={(event) => changeResult(event.target.value as ChessHistoryResult)}
                >
                  <option value="all">All results</option>
                  <option value="win">Wins</option>
                  <option value="draw">Draws</option>
                  <option value="loss">Losses</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div aria-busy={loading} aria-live="polite" className="min-h-64">
          {error ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-bold text-rose-100">{error}</p>
              <Button variant="secondary" onClick={() => setRetryKey((value) => value + 1)}>Try again</Button>
            </div>
          ) : loading && !data ? (
            <div className="grid min-h-64 place-items-center p-6 text-sm font-bold text-slate-400">Loading your games…</div>
          ) : data?.games.length ? (
            <div className={loading ? "opacity-60 transition" : "transition"}>
              <ul className="divide-y divide-white/10">
                {data.games.map((game) => (
                  <li key={game.id} className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5">
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${RESULT_STYLES[game.result]}`}>
                      {game.result}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">vs {game.opponentName}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatOpponentType(game)} · Played {game.playerColor} · {formatTimeControl(game)}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {formatReason(game.resultReason)} · {game.moveCount} {game.moveCount === 1 ? "move" : "moves"} · {formatDate(game.completedAt)}
                      </p>
                    </div>
                    <Button href={`/student/play/game/${encodeURIComponent(game.id)}/analysis`} variant="secondary" className="w-full sm:w-auto">
                      Review key moments
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-lg font-black text-white">No games match these filters.</p>
              <p className="max-w-md text-sm text-slate-400">Complete a computer or live game, or change the filters to see more of your record.</p>
            </div>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-sm text-slate-400">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} matching games
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={loading || pagination.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={loading || pagination.page >= pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
