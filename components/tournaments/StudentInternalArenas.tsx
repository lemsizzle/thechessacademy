"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { InternalArena } from "@/chess/arena/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type ArenaResponse = { ok?: boolean; arenas?: InternalArena[]; matchmaking?: { status: string; gameId: string | null }; error?: string };

function countdown(arena: InternalArena, now: number) {
  const target = arena.status === "scheduled" ? new Date(arena.startsAt).getTime() : new Date(arena.endsAt).getTime();
  const remaining = Math.max(0, target - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours ? `${hours}h ` : ""}${minutes}m ${seconds}s`;
}

export function StudentInternalArenas() {
  const router = useRouter();
  const [arenas, setArenas] = useState<InternalArena[]>([]);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const response = await fetch("/api/student/internal-arenas", { cache: "no-store" });
    const body = await response.json() as ArenaResponse;
    if (!response.ok || !body.arenas) throw new Error(body.error || "Internal Arenas could not be loaded.");
    setArenas(body.arenas);
    const activeGame = body.arenas.find((arena) => arena.entry?.status === "playing" && arena.entry.currentGameId)?.entry?.currentGameId;
    if (activeGame) router.push(`/student/play/live/${activeGame}`);
  }, [router]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Internal Arenas could not be loaded.")); }, [load]);
  useEffect(() => {
    const poll = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") void load().catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(poll);
  }, [load]);

  const ordered = useMemo(() => [...arenas].sort((left, right) => {
    const order = { active: 0, scheduled: 1, finished: 2, cancelled: 3 };
    return order[left.status] - order[right.status] || new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
  }), [arenas]);

  async function join(arena: InternalArena) {
    setPending(arena.id); setMessage("");
    try {
      const response = await fetch(`/api/student/internal-arenas/${arena.id}/join`, { method: "POST" });
      const body = await response.json() as ArenaResponse;
      if (!response.ok || !body.matchmaking) throw new Error(body.error || "Could not join this Arena.");
      if (body.matchmaking.gameId) {
        router.push(`/student/play/live/${body.matchmaking.gameId}`);
        return;
      }
      setMessage(body.matchmaking.status === "waiting" ? "You are in the Arena queue. Keep this page open while we find an opponent." : "You joined the Arena. Return when it begins.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join this Arena.");
    } finally { setPending(""); }
  }

  async function pause(arena: InternalArena) {
    setPending(arena.id); setMessage("");
    try {
      const response = await fetch(`/api/student/internal-arenas/${arena.id}/join`, { method: "DELETE" });
      const body = await response.json() as ArenaResponse;
      if (!response.ok) throw new Error(body.error || "Could not pause matchmaking.");
      setMessage("Arena matchmaking is paused. Rejoin whenever you are ready.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not pause matchmaking.");
    } finally { setPending(""); }
  }

  return (
    <section className="space-y-5" aria-labelledby="academy-arena-heading">
      <Card className="overflow-hidden p-0">
        <div className="h-1 bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-200" />
        <div className="p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-wider text-emerald-200">Play here on Chess Academy</p>
          <h2 id="academy-arena-heading" className="mt-1 text-2xl font-black text-white">Academy Arena</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Join the queue, play as many games as you can, and climb the live standings. Wins earn 2 points and draws earn 1 point.</p>
        </div>
      </Card>

      {message ? <p className="rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm font-bold text-cyan-50" aria-live="polite">{message}</p> : null}

      {ordered.length ? ordered.map((arena) => (
        <Card key={arena.id} className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[11px] font-black uppercase ${arena.status === "active" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : arena.status === "scheduled" ? "border-amber-300/35 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-300"}`}>{arena.status}</span><span className="text-xs font-bold text-slate-400">{arena.timeControl.name} · {arena.rated ? "Rated" : "Casual"}</span></div>
              <h3 className="mt-2 text-xl font-black text-white">{arena.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{arena.description}</p>
              <p className="mt-3 text-sm font-black text-cyan-100">{arena.status === "scheduled" ? `Starts in ${countdown(arena, now)}` : arena.status === "active" ? `${countdown(arena, now)} remaining` : "Final standings"}</p>
            </div>
            <div className="shrink-0 lg:w-56">
              {arena.entry?.status === "playing" && arena.entry.currentGameId ? <Button href={`/student/play/live/${arena.entry.currentGameId}`} className="w-full">Open Game</Button>
                : arena.status === "active" && arena.entry?.status === "waiting" ? <Button type="button" variant="ghost" className="w-full" disabled={pending === arena.id} onClick={() => void pause(arena)}>{pending === arena.id ? "Updating..." : "Pause Matchmaking"}</Button>
                  : arena.status === "active" ? <Button type="button" className="w-full" disabled={pending === arena.id} onClick={() => void join(arena)}>{pending === arena.id ? "Joining..." : arena.entry ? "Enter Matchmaking" : "Join Arena"}</Button>
                    : arena.status === "scheduled" && !arena.entry ? <Button type="button" variant="secondary" className="w-full" disabled={pending === arena.id} onClick={() => void join(arena)}>{pending === arena.id ? "Joining..." : "Join Early"}</Button>
                      : arena.status === "scheduled" ? <p className="rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3 text-center text-sm font-black text-emerald-100">You’re registered</p> : null}
              <Button href={`/student/tournaments/${arena.id}`} variant="ghost" className="mt-2 w-full">Open Lobby</Button>
              {arena.entry ? <p className="mt-2 text-center text-xs font-bold text-slate-400">Your score: <span className="text-amber-100">{arena.entry.score}</span> · rank #{arena.entry.rank}</p> : null}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-md border border-white/10">
            <table className="min-w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-3 py-2">Rank</th><th className="px-3 py-2">Player</th><th className="px-3 py-2">Points</th><th className="px-3 py-2">Games</th><th className="px-3 py-2">W-D-L</th></tr></thead><tbody>{arena.standings.slice(0, 20).map((entry) => <tr key={entry.studentId} className={`border-t border-white/5 ${arena.entry?.studentId === entry.studentId ? "bg-cyan-300/10 text-cyan-50" : "text-slate-200"}`}><td className="px-3 py-2 font-black">#{entry.rank}</td><td className="px-3 py-2 font-bold">{entry.name}{entry.status === "playing" ? " · playing" : entry.status === "waiting" ? " · ready" : ""}</td><td className="px-3 py-2 font-black text-amber-100">{entry.score}</td><td className="px-3 py-2">{entry.gamesPlayed}</td><td className="px-3 py-2">{entry.wins}-{entry.draws}-{entry.losses}</td></tr>)}</tbody></table>
            {!arena.standings.length ? <p className="p-4 text-sm text-slate-500">Be the first student to join.</p> : null}
          </div>
        </Card>
      )) : <Card className="p-6 text-sm text-slate-400">No internal Arenas are scheduled yet. Your teacher can create one from the tournament dashboard.</Card>}
    </section>
  );
}
