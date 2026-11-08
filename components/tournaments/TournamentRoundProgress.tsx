"use client";

import { useEffect, useRef, useState } from "react";
import type { PuzzleTournament } from "@/lib/puzzle-battle/tournament";

export function TournamentRoundCountdown({ tournament }: { tournament: PuzzleTournament }) {
  const [seconds, setSeconds] = useState(0);
  const { roundStartsAt, serverNow, round } = tournament;
  useEffect(() => {
    const observed = performance.now();
    const remaining = (roundStartsAt ?? 0) - (serverNow ?? Date.now());
    const tick = () => setSeconds(Math.max(0, Math.ceil((remaining - (performance.now() - observed)) / 1000)));
    tick();
    if (remaining <= 0) return;
    const timer = setInterval(tick, 250);
    const stop = setTimeout(() => clearInterval(timer), remaining + 1000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [roundStartsAt, serverNow]);
  return seconds > 0 ? <p role="status" className="rounded-lg border border-amber-200/40 bg-amber-200/10 p-3 text-lg font-black text-amber-100">Round {round} starts in {seconds}s — get ready!</p> : null;
}

/** Runs only on a finished battle, never on the active board's move path. */
export function TournamentNextRound({ id, battleId, round, onNext }: { id: string; battleId: string; round: number; onNext: (id: string) => void }) {
  const [tournament, setTournament] = useState<PuzzleTournament | null>(null);
  const [error, setError] = useState("");
  const next = useRef(onNext);
  useEffect(() => { next.current = onNext; }, [onNext]);
  useEffect(() => {
    let stopped = false, running = false, terminal = false;
    const controller = new AbortController();
    async function refresh() {
      if (stopped || running || terminal || document.hidden) return;
      running = true;
      try {
        const response = await fetch(`/api/student/puzzle-tournaments?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Reconnecting to your tournament…");
        if (stopped) return;
        const t = data.tournament as PuzzleTournament;
        setTournament(t); setError("");
        terminal = t.status === "finished" || t.status === "cancelled";
        const match = t.matches.find(m => m.round === t.round && (m.a === t.me || m.b === t.me));
        if (!terminal && t.round > round && match?.battleId && match.battleId !== battleId && !match.result) {
          terminal = true;
          next.current(match.battleId);
        }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Reconnecting to your tournament…"); }
      finally { running = false; }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { stopped = true; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [id, battleId, round]);
  const bye = tournament && tournament.round > round && tournament.matches.some(m => m.round === tournament.round && m.a === tournament.me && !m.b);
  return <div className="space-y-2 text-sm text-cyan-100">
    <p role="status">{error || tournament?.advanceError || (tournament?.status === "finished" ? "Tournament complete! See the final standings below."
      : tournament?.status === "cancelled" ? "The tournament has been cancelled."
      : bye ? `You have a bye for round ${tournament.round}: 2 points. Your next battle will open automatically.`
      : "Waiting for all battles to finish. Your next round will open automatically after a short countdown.")}</p>
    {tournament?.status === "active" && <TournamentRoundCountdown tournament={tournament} />}
  </div>;
}
