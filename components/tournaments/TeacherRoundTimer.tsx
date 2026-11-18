"use client";

import { useEffect, useState } from "react";
import type { PuzzleTournament } from "@/lib/puzzle-battle/tournament";
import { tournamentRoundClock } from "@/lib/puzzle-battle/roundClock";

export function TeacherRoundTimer({ tournament }: { tournament: PuzzleTournament }) {
  const [now, setNow] = useState(tournament.serverNow ?? Date.now());
  const { serverNow, roundStartsAt, duration, status, round } = tournament;
  const pending = tournament.matches.some(m => m.round === round && !m.result);
  useEffect(() => {
    // Tick locally from the server's clock. Device clock changes and tab sleep
    // cannot extend a round, and displaying seconds adds no network requests.
    const anchor = serverNow ?? Date.now(), observed = performance.now();
    const tick = () => setNow(anchor + performance.now() - observed);
    tick();
    const untilEnd = (roundStartsAt ?? 0) + duration * 1000 - anchor;
    if (status !== "active" || !pending || roundStartsAt == null || untilEnd <= 0) return;
    const interval = setInterval(tick, 250);
    const stop = setTimeout(() => { tick(); clearInterval(interval); }, untilEnd + 250);
    return () => { clearInterval(interval); clearTimeout(stop); };
  }, [serverNow, roundStartsAt, duration, status, round, pending]);
  const clock = tournamentRoundClock(tournament, now);
  const text = clock.seconds == null ? "--:--" : `${Math.floor(clock.seconds / 60)}:${String(clock.seconds % 60).padStart(2, "0")}`;
  const urgent = clock.label === "Round time left" && clock.seconds != null && clock.seconds <= 10;
  return <div data-testid="teacher-round-timer" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${urgent ? "border-amber-300/60 bg-amber-300/10 text-amber-100" : "border-cyan-200/30 bg-slate-950/80 text-cyan-100"}`}>
    <div><p className="text-sm font-black">Round {round} of {tournament.rounds}</p><p className="mt-1 text-sm text-slate-300">{clock.label}</p></div>
    <span role="timer" aria-label={clock.label} className="font-mono text-4xl font-black tabular-nums sm:text-5xl">{text}</span>
  </div>;
}
