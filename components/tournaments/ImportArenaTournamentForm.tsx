"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TournamentSourceBadge } from "@/components/tournaments/TournamentSourceBadge";
import type { Tournament } from "@/lib/types";
import { useState } from "react";

export function ImportArenaTournamentForm({
  existingTournaments,
  onImport,
  disabled = false
}: {
  existingTournaments: Tournament[];
  onImport: (tournament: Tournament) => void;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [preview, setPreview] = useState<Tournament>();
  const [message, setMessage] = useState("Paste a Lichess Arena URL or tournament ID.");
  const [loading, setLoading] = useState(false);

  async function importTournament() {
    setLoading(true);
    setPreview(undefined);
    try {
      const response = await fetch("/api/lichess/tournaments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input })
      });
      const data = await response.json() as { tournament?: Tournament; error?: string; warning?: string; mode?: string };
      if (!response.ok || !data.tournament) {
        setMessage(data.error ?? "Could not import that Arena tournament.");
        return;
      }
      const existing = existingTournaments.find((tournament) => tournament.lichessId?.toLowerCase() === data.tournament!.lichessId?.toLowerCase());
      if (existing) {
        setPreview(existing);
        setMessage(`This Arena is already saved as ${existing.source === "team_sync" ? "a team tournament" : "an imported tournament"}. You can sync its results without importing it again.`);
        return;
      }
      const tournament = { ...data.tournament, isPublic };
      onImport(tournament);
      setPreview(tournament);
      setMessage(`Imported ${tournament.name}.${data.warning ? ` ${data.warning}` : ""}`);
      setInput("");
    } catch {
      setMessage("Could not import the Arena tournament.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="font-black text-white">Import Arena Tournament</h2>
      <p className="mt-1 text-sm text-slate-400">Accepts a Lichess Arena URL or ID. Other websites and non-Arena Lichess pages are rejected.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="https://lichess.org/tournament/abc123 or abc123"
        />
        <Button onClick={importTournament} disabled={loading || disabled}>{loading ? "Importing..." : disabled ? "Loading Team Arenas..." : "Import Tournament"}</Button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-300">
        <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
        Show this imported Arena on the public tournament page
      </label>
      <p className="mt-3 text-sm text-slate-300">{message}</p>
      {preview && (
        <div className="mt-4 rounded-md border border-white/10 bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <TournamentSourceBadge source={preview.source} />
            <span className="text-xs font-black uppercase text-slate-400">{preview.status}</span>
          </div>
          <p className="mt-2 font-black text-white">{preview.name}</p>
          <p className="mt-1 text-xs text-slate-400">ID: {preview.lichessId} - {preview.isPublic ? "Public" : "Admin only"}</p>
        </div>
      )}
    </Card>
  );
}
