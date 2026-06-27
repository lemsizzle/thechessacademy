"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TournamentStatusBadge } from "@/components/tournaments/TournamentStatusBadge";
import { TournamentSourceBadge } from "@/components/tournaments/TournamentSourceBadge";
import type { Tournament } from "@/lib/types";
import { useEffect, useState } from "react";

function formatCountdown(milliseconds: number) {
  if (milliseconds <= 0) return "Starting now";

  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function metaValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "Not listed";
  if (typeof value === "boolean") return value ? "Rated" : "Casual";
  return String(value);
}

function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const safeUrl = isSafeUrl(tournament.url);
  const [now, setNow] = useState(() => Date.now());
  const startsAt = new Date(tournament.startsAt).getTime();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = tournament.status === "finished"
    ? "Finished"
    : tournament.status === "ongoing"
      ? "Live now"
      : formatCountdown(startsAt - now);

  return (
    <Card className="overflow-hidden p-0">
      <div className="h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200" />
      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TournamentStatusBadge status={tournament.status} />
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs font-black uppercase text-slate-200">Arena</span>
              <TournamentSourceBadge source={tournament.source} />
            </div>
            <h2 className="mt-3 font-black text-white">{tournament.name}</h2>
            {tournament.description && <p className="mt-2 text-sm text-slate-300">{tournament.description}</p>}
          </div>
          {safeUrl ? (
            <Button href={tournament.url} target="_blank" rel="noopener noreferrer" variant="secondary">Join on Lichess</Button>
          ) : (
            <span className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm font-bold text-red-100">Unsafe URL</span>
          )}
        </div>

        <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
          <p><span className="font-black text-slate-100">Countdown:</span> {countdown}</p>
          <p><span className="font-black text-slate-100">Duration:</span> {tournament.durationMinutes ? `${tournament.durationMinutes} min` : "Not listed"}</p>
          <p><span className="font-black text-slate-100">Time:</span> {metaValue(tournament.timeControl)}</p>
          <p><span className="font-black text-slate-100">Rated:</span> {metaValue(tournament.rated)}</p>
          <p><span className="font-black text-slate-100">Variant:</span> {metaValue(tournament.variant)}</p>
          <p><span className="font-black text-slate-100">Players:</span> {metaValue(tournament.playerCount)}</p>
        </div>
      </div>
    </Card>
  );
}
