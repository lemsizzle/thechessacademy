"use client";

import { useEffect, useState } from "react";
import { createAnalysisTree } from "@/chess/analysis/tree";
import type { AnalysisTree, CompletedGameRecord } from "@/chess/analysis/types";
import { AnalysisWorkspace } from "@/chess/components/AnalysisWorkspace";
import { AddToStudyDialog } from "@/chess/components/AddToStudyDialog";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export function GameAnalysisLoader({ gameId, basePath }: { gameId: string; basePath: "/student" | "/admin" }) {
  const [game, setGame] = useState<CompletedGameRecord | null>(null);
  const [analysisTree, setAnalysisTree] = useState<AnalysisTree | null>(null);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chess/games/${encodeURIComponent(gameId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { game?: CompletedGameRecord; error?: string };
        if (!response.ok || !body.game) throw new Error(body.error ?? "Game could not be loaded.");
        if (!cancelled) {
          setGame(body.game);
          setAnalysisTree(createAnalysisTree(body.game.initialFen, body.game.moves));
        }
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Game could not be loaded."); });
    return () => { cancelled = true; };
  }, [gameId]);

  if (error && !game) return <Card className="p-6 text-rose-100">{error} <Button className="ml-3" variant="ghost" href={`${basePath}/studies`}>Back to studies</Button></Card>;
  if (!game || !analysisTree) return <Card className="p-6 text-sm text-slate-300">Loading replay and move history…</Card>;

  return <><AnalysisWorkspace
    initialTree={analysisTree}
    gameMode
    reviewColor={game.playerColor}
    title={`You vs ${game.opponentName}`}
    subtitle={`${new Date(game.completedAt).toLocaleString()} · ${game.result.toUpperCase()} by ${game.resultReason.replaceAll("_", " ")} · ${game.timeControl.name ?? "Game"}`}
    actions={<>
      <Button type="button" variant="secondary" onClick={() => setAddOpen(true)}>Add to Study</Button>
      <Button variant="ghost" href={`${basePath}/studies`}>All studies</Button>
    </>}
    onTreeChange={setAnalysisTree}
  />{addOpen && <AddToStudyDialog gameId={game.id} gameTitle={`Game vs ${game.opponentName}`} analysisTree={analysisTree} basePath={basePath} onClose={() => setAddOpen(false)} />}</>;
}
