"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TIME_CONTROLS } from "@/chess/game/config";
import type { InternalArena } from "@/chess/arena/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type ArenaResponse = { ok?: boolean; arenas?: InternalArena[]; arena?: InternalArena; matchmaking?: { gameId: string | null }; error?: string };

function fieldClass() {
  return "rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60";
}

export function AdminInternalArenas({ adminActionToken }: { adminActionToken: string }) {
  const [arenas, setArenas] = useState<InternalArena[]>([]);
  const [name, setName] = useState("Class Arena");
  const [description, setDescription] = useState("Play as many good games as you can before time runs out.");
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timeControlId, setTimeControlId] = useState("10m");
  const [rated, setRated] = useState(false);
  const [classGroup, setClassGroup] = useState("");
  const [firstByArena, setFirstByArena] = useState<Record<string, string>>({});
  const [secondByArena, setSecondByArena] = useState<Record<string, string>>({});
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/internal-arenas", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "x-admin-action-token": adminActionToken }
    });
    const body = await response.json() as ArenaResponse;
    if (!response.ok || !body.arenas) throw new Error(body.error || "Internal Arenas could not be loaded.");
    setArenas(body.arenas);
  }, [adminActionToken]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Internal Arenas could not be loaded.")); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load().catch(() => undefined);
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const activeCount = useMemo(() => arenas.filter((arena) => arena.status === "active").length, [arenas]);

  async function createArena() {
    setPending("create"); setMessage("");
    try {
      const response = await fetch("/api/admin/internal-arenas", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-admin-action-token": adminActionToken },
        body: JSON.stringify({ name, description, startsAt: startsAt || undefined, durationMinutes, timeControlId, rated, classGroup })
      });
      const body = await response.json() as ArenaResponse;
      if (!response.ok || !body.arena) throw new Error(body.error || "Arena could not be created.");
      setMessage(`${body.arena.name} is ready for students.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Arena could not be created.");
    } finally {
      setPending("");
    }
  }

  async function updateArena(arena: InternalArena, action: "start" | "finish" | "cancel") {
    setPending(`${action}:${arena.id}`); setMessage("");
    try {
      const response = await fetch(`/api/admin/internal-arenas/${arena.id}`, {
        method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json", "x-admin-action-token": adminActionToken }, body: JSON.stringify({ action })
      });
      const body = await response.json() as ArenaResponse;
      if (!response.ok || !body.arena) throw new Error(body.error || "Arena could not be updated.");
      setMessage(`${body.arena.name} is now ${body.arena.status}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Arena could not be updated.");
    } finally { setPending(""); }
  }

  async function forceMatch(arena: InternalArena) {
    const firstStudentId = firstByArena[arena.id];
    const secondStudentId = secondByArena[arena.id];
    if (!firstStudentId || !secondStudentId || firstStudentId === secondStudentId) {
      setMessage("Choose two different available students.");
      return;
    }
    setPending(`pair:${arena.id}`); setMessage("");
    try {
      const response = await fetch(`/api/admin/internal-arenas/${arena.id}/force-match`, {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-admin-action-token": adminActionToken }, body: JSON.stringify({ firstStudentId, secondStudentId })
      });
      const body = await response.json() as ArenaResponse;
      if (!response.ok || !body.matchmaking?.gameId) throw new Error(body.error || "Students could not be paired.");
      setMessage("The teacher-created pairing is live. Both students will be sent to their board.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Students could not be paired.");
    } finally { setPending(""); }
  }

  return (
    <section className="space-y-5" aria-labelledby="internal-arena-heading">
      <Card className="overflow-hidden p-0">
        <div className="h-1 bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-200" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-200">Hosted on Chess Academy</p>
              <h2 id="internal-arena-heading" className="mt-1 text-2xl font-black text-white">Internal Arena Tournaments</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Students continuously enter the queue, play on the Academy board, and earn 2 points for a win or 1 for a draw. You can force any two available students into a game.</p>
            </div>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase text-emerald-100">{activeCount} active</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1 text-xs font-bold text-slate-300">Arena name<input className={fieldClass()} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Start time<input className={fieldClass()} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /><span className="font-normal text-slate-500">Leave blank to start immediately.</span></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Duration<input className={fieldClass()} type="number" min={10} max={240} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value) || 60)} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Game clock<select className={fieldClass()} value={timeControlId} onChange={(event) => setTimeControlId(event.target.value)}>{TIME_CONTROLS.filter((control) => control.initialMs !== null).map((control) => <option key={control.id} value={control.id}>{control.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-bold text-slate-300">Class group<input className={fieldClass()} value={classGroup} onChange={(event) => setClassGroup(event.target.value)} placeholder="All students" /></label>
            <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200"><input type="checkbox" checked={rated} onChange={(event) => setRated(event.target.checked)} className="h-4 w-4 accent-emerald-300" />Rated Academy games</label>
            <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2 xl:col-span-3">Description<textarea className={`${fieldClass()} min-h-20`} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          </div>
          <Button type="button" className="mt-4" disabled={pending === "create"} onClick={() => void createArena()}>{pending === "create" ? "Creating..." : "Create Internal Arena"}</Button>
        </div>
      </Card>

      {message ? <p className="rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm font-bold text-cyan-50" aria-live="polite">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {arenas.map((arena) => {
          const available = arena.standings.filter((entry) => entry.status === "waiting" || entry.status === "joined");
          return (
            <Card key={arena.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-black uppercase text-emerald-200">{arena.status} · {arena.timeControl.name} · {arena.rated ? "Rated" : "Casual"}</p><h3 className="mt-1 text-xl font-black text-white">{arena.name}</h3><p className="mt-1 text-sm text-slate-400">{arena.classGroup || "All students"} · {arena.durationMinutes} minutes · {arena.standings.length} joined</p></div>
                <div className="flex flex-wrap gap-2">
                  <Button href={`/admin/tournaments/${arena.id}`} variant="secondary">Open Lobby</Button>
                  {arena.status === "scheduled" ? <Button type="button" variant="secondary" disabled={Boolean(pending)} onClick={() => void updateArena(arena, "start")}>Start Now</Button> : null}
                  {arena.status === "active" ? <Button type="button" variant="ghost" disabled={Boolean(pending)} onClick={() => void updateArena(arena, "finish")}>Finish</Button> : null}
                  {arena.status === "scheduled" || arena.status === "active" ? <Button type="button" variant="ghost" disabled={Boolean(pending)} onClick={() => void updateArena(arena, "cancel")}>Cancel</Button> : null}
                </div>
              </div>

              {arena.status === "active" ? (
                <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4">
                  <p className="text-xs font-black uppercase text-amber-100">Teacher force matchmaking</p>
                  <p className="mt-1 text-xs text-amber-50/80">Choose two students who are not currently playing.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <select className={fieldClass()} aria-label="First student" value={firstByArena[arena.id] ?? ""} onChange={(event) => setFirstByArena((value) => ({ ...value, [arena.id]: event.target.value }))}><option value="">First student</option>{available.map((entry) => <option key={entry.studentId} value={entry.studentId}>{entry.name} ({entry.status})</option>)}</select>
                    <select className={fieldClass()} aria-label="Second student" value={secondByArena[arena.id] ?? ""} onChange={(event) => setSecondByArena((value) => ({ ...value, [arena.id]: event.target.value }))}><option value="">Second student</option>{available.map((entry) => <option key={entry.studentId} value={entry.studentId}>{entry.name} ({entry.status})</option>)}</select>
                  </div>
                  <Button type="button" variant="secondary" className="mt-3 w-full" disabled={pending === `pair:${arena.id}` || available.length < 2} onClick={() => void forceMatch(arena)}>{pending === `pair:${arena.id}` ? "Pairing..." : "Force Match"}</Button>
                </div>
              ) : null}

              <div className="mt-4 overflow-x-auto rounded-md border border-white/10">
                <table className="min-w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">W-D-L</th><th className="px-3 py-2">State</th></tr></thead><tbody>{arena.standings.map((entry) => <tr key={entry.studentId} className="border-t border-white/5 text-slate-200"><td className="px-3 py-2">{entry.rank}</td><td className="px-3 py-2 font-bold">{entry.name}</td><td className="px-3 py-2 font-black text-amber-100">{entry.score}</td><td className="px-3 py-2">{entry.wins}-{entry.draws}-{entry.losses}</td><td className="px-3 py-2">{entry.currentGameId ? <a className="font-bold text-cyan-200 underline" href={`/admin/live-games/${entry.currentGameId}`}>Watch</a> : entry.status}</td></tr>)}</tbody></table>
                {!arena.standings.length ? <p className="p-4 text-sm text-slate-500">No students have joined yet.</p> : null}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
