"use client";

import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { challengeIsPending, ONLINE_CLOCKS, onlineChallengeLabel } from "@/lib/onlinePlay/types";
import { useOnlinePlay } from "./OnlinePlayProvider";

export function OnlinePlayPanel() {
  const online = useOnlinePlay();
  const id = useId();
  const [clock, setClock] = useState("10m");
  if (!online) return null;
  const { state, loading, error, pending, act } = online;
  const incoming = state.incoming.filter((c) => challengeIsPending(c));
  const outgoing = state.outgoing.filter((c) => challengeIsPending(c));
  const ready = [...state.incoming, ...state.outgoing].filter((c) => c.status === "accepted" && c.gameId);
  return <section aria-labelledby={`${id}-title`} className="space-y-3 rounded-xl border border-cyan-200/20 bg-slate-950 p-4">
    <div className="flex items-center justify-between gap-3">
      <h2 id={`${id}-title`} className="text-xl font-black text-white">Online now <span className="text-sm text-slate-400">({state.students.length})</span></h2>
      <span className="text-xs font-bold text-cyan-200">Live games</span>
    </div>
    {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}
    {incoming.map((c) => <article key={c.id} className="rounded-lg border border-amber-200/30 bg-amber-200/10 p-3">
      <p className="break-words font-bold text-white">{c.opponentName} · {ONLINE_CLOCKS.find((t) => t.id === c.timeControlId)?.name}</p>
      <p className="text-xs text-amber-100">Incoming live challenge</p>
      <div className="mt-2 flex flex-wrap gap-2"><Button disabled={pending} onClick={() => void act({ action: "accept", challengeId: c.id })}>Accept</Button><Button variant="ghost" disabled={pending} onClick={() => void act({ action: "decline", challengeId: c.id })}>Decline</Button></div>
    </article>)}
    {ready.map((c) => <Button key={c.id} href={`/student/play/live/${c.gameId}`} variant="secondary" className="w-full">Open game with {c.opponentName}</Button>)}
    <label className="flex items-center gap-3 text-sm font-bold text-slate-300" htmlFor={`${id}-clock`}>Clock
      <select id={`${id}-clock`} value={clock} onChange={(e) => setClock(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-900 p-2 text-white">
        {ONLINE_CLOCKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </label>
    <p className="text-xs text-slate-400">Random colours. Invitations expire after 2 minutes.</p>
    {loading ? <p role="status" className="text-sm text-slate-400">Finding online students…</p> : !state.students.length ? <p className="text-sm text-slate-400">No other students are online right now.</p> : null}
    <ul className="max-h-72 space-y-2 overflow-y-auto">
      {state.students.map((student) => {
        const label = onlineChallengeLabel(student, state);
        return <li key={student.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900 p-3">
          <span className="min-w-0 break-words font-bold text-white"><span aria-hidden="true" className={`mr-2 inline-block size-2 rounded-full ${student.busy ? "bg-amber-300" : "bg-emerald-300"}`} />{student.name}</span>
          <Button variant="secondary" disabled={pending || label !== "Challenge"} aria-label={`${label} ${student.name}`} onClick={() => void act({ action: "challenge", recipientId: student.id, timeControlId: clock })}>{label}</Button>
        </li>;
      })}
    </ul>
    {outgoing.map((c) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300"><span>Waiting for {c.opponentName} · {ONLINE_CLOCKS.find((t) => t.id === c.timeControlId)?.name}</span><Button variant="ghost" disabled={pending} onClick={() => void act({ action: "cancel", challengeId: c.id })}>Cancel</Button></div>)}
    {state.outgoing.filter((c) => ["declined", "expired", "cancelled"].includes(c.status)).slice(0, 2).map((c) => <p key={c.id} className="text-xs text-slate-400">{c.opponentName}: challenge {c.status}.</p>)}
  </section>;
}
