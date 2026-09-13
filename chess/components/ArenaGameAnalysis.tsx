"use client";

import { useEffect, useState } from "react";
import type { TeacherLiveGameSnapshot } from "@/chess/live/types";
import type { AnalysisTree } from "@/chess/analysis/types";
import { createAnalysisTree } from "@/chess/analysis/tree";
import { AnalysisWorkspace } from "@/chess/components/AnalysisWorkspace";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export function ArenaGameAnalysis({ tournamentId, gameId, role }: { tournamentId: string; gameId: string; role: "teacher" | "student" }) {
  const [loaded, setLoaded] = useState<{ game: TeacherLiveGameSnapshot; tree: AnalysisTree } | null>(null);
  const [error, setError] = useState("");
  const backHref = `/${role === "teacher" ? "admin" : "student"}/tournaments/${tournamentId}`;
  useEffect(() => {
    const controller = new AbortController();
    const endpoint = role === "teacher" ? `/api/admin/live-games/${encodeURIComponent(gameId)}`
      : `/api/student/internal-arenas/${encodeURIComponent(tournamentId)}/games/${encodeURIComponent(gameId)}`;
    setLoaded(null); setError("");
    void fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json() as { game?: TeacherLiveGameSnapshot; error?: string };
      if (!response.ok || !body.game) throw new Error(body.error || "Game could not be loaded.");
      if (body.game.arenaTournamentId !== tournamentId || body.game.status !== "completed") throw new Error("Only completed games from this tournament can be analyzed.");
      const tree = createAnalysisTree(body.game.initialFen, body.game.moves);
      if (!controller.signal.aborted) setLoaded({ game: body.game, tree });
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Game could not be loaded."); });
    return () => controller.abort();
  }, [gameId, tournamentId, role]);
  const back = <Button variant="secondary" href={backHref}>← Back to tournament lobby</Button>;
  if (!loaded) return <Card className="space-y-3 p-5"><p role="status" className={error ? "text-rose-100" : "text-slate-300"}>{error || "Loading game analysis…"}</p>{back}</Card>;
  const { game, tree } = loaded;
  const result = game.winnerColor ? `${game.players[game.winnerColor].name} won` : "Draw";
  return <AnalysisWorkspace key={game.id} initialTree={tree}
    title={`${game.players.white.name} vs ${game.players.black.name}`}
    subtitle={`${result}${game.resultReason ? ` by ${game.resultReason.replaceAll("_", " ")}` : ""} · ${game.timeControl.name}`}
    actions={back} />;
}
