"use client";

import { useState } from "react";
import type { InternalArena } from "@/chess/arena/types";
import { Button } from "@/components/Button";

function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ArenaScheduleEditor({ arena, adminActionToken, onSaved }: {
  arena: InternalArena; adminActionToken: string; onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState("");
  const [originalStart, setOriginalStart] = useState("");
  const [duration, setDuration] = useState("60");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const started = arena.status === "active" || Date.parse(arena.startsAt) <= Date.now();
  const editable = arena.status === "scheduled" || arena.status === "active";
  const field = "min-w-0 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60";
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/internal-arenas/${arena.id}`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-admin-action-token": adminActionToken },
        body: JSON.stringify({ action: "schedule", durationMinutes: Number(duration),
          startsAt: started || start === localDateTime(originalStart) ? originalStart : new Date(start).toISOString() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Schedule could not be saved.");
      setEditing(false); setMessage("Schedule saved."); await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Schedule could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="mt-4 rounded-lg border border-white/10 p-3">
    <p className="text-sm text-slate-300">Starts {new Date(arena.startsAt).toLocaleString()} · Ends {new Date(arena.endsAt).toLocaleString()}</p>
    {editable && !editing && <Button className="mt-2" variant="secondary" onClick={() => {
      setOriginalStart(arena.startsAt); setStart(localDateTime(arena.startsAt)); setDuration(String(arena.durationMinutes)); setMessage(""); setEditing(true);
    }}>Edit schedule</Button>}
    {editable && editing && <form onSubmit={save} className="mt-3 space-y-3" aria-label={`Edit schedule for ${arena.name}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-slate-300">Start time (your local time)
          <input className={field} type="datetime-local" required value={start} disabled={started || saving} onChange={e => setStart(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-300">Duration (minutes)
          <input className={field} type="number" min={10} max={240} step={1} required value={duration} disabled={saving} onChange={e => setDuration(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-slate-400">{started ? "The tournament has started. Change its total duration to adjust when it ends." : "Changes appear in the student lobby. Times use your device’s timezone."}</p>
      <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save schedule"}</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button></div>
    </form>}
    {message && <p role="status" className="mt-2 text-sm text-cyan-100">{message}</p>}
  </div>;
}
