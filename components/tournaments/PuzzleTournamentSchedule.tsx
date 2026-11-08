"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import type { PuzzleTournament } from "@/lib/puzzle-battle/tournament";

const field = "mt-1 block min-h-11 min-w-0 w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white";
export function localScheduleValue(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function ScheduleInput({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [zone, setZone] = useState("your device’s timezone");
  useEffect(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  return <label className="block min-w-0 text-sm font-bold">Start time (optional)
    <input aria-label="Start time (optional)" className={field} type="datetime-local" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} />
    <span className="mt-1 block text-xs font-normal text-slate-400">{zone}. Leave blank to start manually.</span>
  </label>;
}

export function ScheduledTournamentStart({ tournament, onDue }: { tournament: PuzzleTournament; onDue: () => void }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const { startsAt, serverNow } = tournament;
  useEffect(() => {
    if (!startsAt) return;
    const remaining = Date.parse(startsAt) - (serverNow ?? Date.now()), observed = performance.now();
    let notified = remaining <= 0;
    const tick = () => {
      const value = Math.max(0, Math.ceil((remaining - (performance.now() - observed)) / 1000));
      setSeconds(value);
      if (!value && !notified) { notified = true; onDue(); }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startsAt, serverNow, onDue]);
  if (!startsAt) return null;
  const n = seconds ?? 0;
  const clock = `${n >= 86400 ? `${Math.floor(n / 86400)}d ` : ""}${Math.floor(n / 3600) % 24}h ${Math.floor(n / 60) % 60}m ${n % 60}s`;
  return <div className="rounded-lg border border-cyan-200/30 bg-cyan-200/5 p-3 text-cyan-100">
    <p className="font-bold">Scheduled for {new Date(startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
    <p className="mt-1 text-xs text-slate-400">Shown in your device’s timezone.</p>
    <p className="mt-2 font-black tabular-nums" role="timer">{seconds === null ? "" : seconds > 0 ? `Starts in ${clock}` : tournament.entries.length < 2 ? "Waiting for at least 2 players to join." : "Starting automatically…"}</p>
    <p className="mt-1 text-sm">Join before the start. A 10-second ready countdown begins when pairings are prepared.</p>
    {tournament.advanceError && <p role="status" className="mt-2 text-amber-100">{tournament.advanceError}</p>}
  </div>;
}

export function PuzzleTournamentScheduleEditor({ tournament, disabled, save }: { tournament: PuzzleTournament; disabled: boolean; save: (startsAt: string | null) => Promise<boolean | void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tournament.startsAt ? localScheduleValue(tournament.startsAt) : "");
  return editing ? <form aria-label="Edit tournament schedule" className="space-y-3 rounded-lg border border-white/10 p-3" onSubmit={async e => {
    e.preventDefault();
    if (await save(value ? new Date(value).toISOString() : null)) setEditing(false);
  }}>
    <ScheduleInput value={value} onChange={setValue} disabled={disabled} />
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={disabled}>Save schedule</Button><Button type="button" variant="secondary" disabled={disabled} onClick={() => setValue("")}>Remove scheduled time</Button><Button type="button" variant="ghost" disabled={disabled} onClick={() => setEditing(false)}>Cancel</Button></div>
  </form> : <Button variant="secondary" disabled={disabled} onClick={() => { setValue(tournament.startsAt ? localScheduleValue(tournament.startsAt) : ""); setEditing(true); }}>{tournament.startsAt ? "Edit schedule" : "Schedule a start time"}</Button>;
}
