"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Tournament } from "@/lib/types";
import { useState } from "react";

function fieldClass() {
  return "rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60";
}

export function ManualTournamentForm({ onAdd }: { onAdd: (tournament: Tournament) => void }) {
  const [name, setName] = useState("Manual Tournament");
  const [startsAt, setStartsAt] = useState("");
  const [url, setUrl] = useState("https://lichess.org/team/outschool-battleground");
  const [description, setDescription] = useState("Added manually as a fallback.");
  const [isActive, setIsActive] = useState(true);

  function addTournament() {
    const date = startsAt ? new Date(startsAt) : new Date(Date.now() + 60 * 60 * 1000);
    onAdd({
      id: `manual-tournament-${Date.now()}`,
      name: name.trim() || "Manual Tournament",
      description,
      status: date.getTime() > Date.now() ? "upcoming" : "ongoing",
      startsAt: date.toISOString(),
      url: url.trim() || "https://lichess.org/team/outschool-battleground",
      source: "manual_fallback",
      isActive,
      isPublic: isActive,
      syncedAt: new Date().toISOString()
    });
    setName("Manual Tournament");
    setDescription("Added manually as a fallback.");
  }

  return (
    <Card className="p-4">
      <h2 className="font-black text-white">Manual Tournament Fallback</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input className={fieldClass()} value={name} onChange={(event) => setName(event.target.value)} placeholder="Tournament name" />
        <input className={fieldClass()} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        <input className={fieldClass()} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Lichess URL" />
        <input className={fieldClass()} value="Arena fallback" readOnly aria-label="Tournament format" />
        <textarea className={`${fieldClass()} min-h-20 md:col-span-2`} value={description} onChange={(event) => setDescription(event.target.value)} />
        <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
          Active
        </label>
      </div>
      <Button className="mt-4" onClick={addTournament}>Add Manual Tournament</Button>
    </Card>
  );
}
