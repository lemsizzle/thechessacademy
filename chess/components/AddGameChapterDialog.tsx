"use client";

import { useEffect, useState } from "react";
import type { CompletedGameRecord, StudyChapter } from "@/chess/analysis/types";
import { Button } from "@/components/Button";

export function AddGameChapterDialog({ studyId, onAdded, onClose }: { studyId: string; onAdded: (chapter: StudyChapter) => void; onClose: () => void }) {
  const [games, setGames] = useState<CompletedGameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/chess/games?limit=50", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as { games?: CompletedGameRecord[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Games could not be loaded.");
      setGames(body.games ?? []);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Games could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  async function add(game: CompletedGameRecord) {
    setAddingId(game.id);
    const response = await fetch(`/api/chess/studies/${studyId}/chapters`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceGameId: game.id, title: `vs ${game.opponentName}` })
    });
    const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
    if (!response.ok || !body.chapter) { setError(body.error ?? "Game could not be added."); setAddingId(""); return; }
    onAdded(body.chapter);
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="add-game-title" className="w-full max-w-xl rounded-xl border border-cyan-200/25 bg-slate-950 p-5">
    <h2 id="add-game-title" className="text-2xl font-black text-white">Add completed game</h2><p className="mt-1 text-sm text-slate-400">The game becomes a new chapter with its own editable analysis tree.</p>
    <div className="scrollbar-soft mt-4 max-h-80 divide-y divide-white/5 overflow-y-auto rounded-md border border-white/10">{loading ? <p className="p-4 text-sm text-slate-400">Loading games…</p> : games.length ? games.map((game) => <div key={game.id} className="flex items-center justify-between gap-3 p-3"><div><p className="font-bold text-white">vs {game.opponentName} · {game.result}</p><p className="text-xs text-slate-500">{new Date(game.completedAt).toLocaleString()}</p></div><Button type="button" variant="secondary" disabled={Boolean(addingId)} onClick={() => void add(game)}>{addingId === game.id ? "Adding…" : "Add"}</Button></div>) : <p className="p-4 text-sm text-slate-400">No completed internal games are available yet.</p>}</div>
    {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}<div className="mt-4 flex justify-end"><Button type="button" variant="ghost" onClick={onClose}>Close</Button></div>
  </section></div>;
}
