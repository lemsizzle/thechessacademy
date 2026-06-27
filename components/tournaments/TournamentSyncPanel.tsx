"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export function TournamentSyncPanel({
  teamId,
  mode,
  syncedAt,
  warning,
  isSyncing,
  onSync
}: {
  teamId: string;
  mode?: "connected" | "mock";
  syncedAt?: string;
  warning?: string;
  isSyncing: boolean;
  onSync: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-cyan-100">Lichess Team</p>
          <h2 className="mt-1 font-black text-white">{teamId || "Not configured"}</h2>
          <p className="mt-1 text-sm text-slate-400">Last sync: {syncedAt ? new Date(syncedAt).toLocaleString() : "Not yet"} - {mode ?? "unknown"}</p>
          {warning && <p className="mt-2 text-sm font-bold text-amber-100">{warning}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={`https://lichess.org/team/${teamId || "outschool-battleground"}`} target="_blank" rel="noopener noreferrer" variant="ghost">Open Team</Button>
          <Button onClick={onSync} disabled={isSyncing} variant="secondary">{isSyncing ? "Syncing..." : "Sync Arena Tournaments"}</Button>
        </div>
      </div>
    </Card>
  );
}
