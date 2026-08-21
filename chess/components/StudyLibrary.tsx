"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompletedGameRecord, ReviewAssignment, StudySummary } from "@/chess/analysis/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AddToStudyDialog } from "@/chess/components/AddToStudyDialog";
import { ReviewAssignmentCards } from "@/chess/components/ReviewAssignmentCards";

export function StudyLibrary({ basePath }: { basePath: "/student" | "/admin" }) {
  const router = useRouter();
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [games, setGames] = useState<CompletedGameRecord[]>([]);
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedGame, setSelectedGame] = useState<CompletedGameRecord | null>(null);

  function load() {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/chess/studies", { cache: "no-store" }).then((response) => response.json().then((body) => ({ response, body }))),
      fetch("/api/chess/games?limit=20", { cache: "no-store" }).then((response) => response.json().then((body) => ({ response, body }))),
      basePath === "/student" ? fetch("/api/chess/review-assignments", { cache: "no-store" }).then((response) => response.json().then((body) => ({ response, body }))) : Promise.resolve(null)
    ]).then(([studyResult, gameResult, assignmentResult]) => {
      if (!studyResult.response.ok) throw new Error(studyResult.body.error ?? "Studies could not be loaded.");
      if (!gameResult.response.ok) throw new Error(gameResult.body.error ?? "Games could not be loaded.");
      if (assignmentResult && !assignmentResult.response.ok) throw new Error(assignmentResult.body.error ?? "Review assignments could not be loaded.");
      setStudies(studyResult.body.studies ?? []);
      setGames(gameResult.body.games ?? []);
      setAssignments(assignmentResult?.body.assignments ?? []);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Chess library could not be loaded."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function createBlank() {
    setCreating(true);
    try {
      const response = await fetch("/api/chess/studies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Untitled Study" }) });
      const body = await response.json().catch(() => ({})) as { studyId?: string; error?: string };
      if (!response.ok || !body.studyId) throw new Error(body.error ?? "Study could not be created.");
      router.push(`${basePath}/studies/${body.studyId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Study could not be created.");
      setCreating(false);
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/60 p-4">
      <div><h2 className="text-xl font-black text-white">Your chess notebook</h2><p className="mt-1 text-sm text-slate-400">Build move trees, save notes, and organize games into chapters.</p></div>
      <Button type="button" disabled={creating} onClick={createBlank}>{creating ? "Creating…" : "New Study"}</Button>
    </div>
    {error && <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}
    {loading ? <Card className="p-6 text-sm text-slate-300">Loading studies and completed games…</Card> : <>
      {basePath === "/student" ? <section>
        <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-black uppercase text-amber-200">Teacher reviews</p><h2 className="text-xl font-black text-white">Assigned to you</h2></div><span className="text-xs text-slate-500">{assignments.filter((assignment) => assignment.status === "assigned" || assignment.status === "returned").length} to answer</span></div>
        <ReviewAssignmentCards initialAssignments={assignments} basePath="/student" emptyMessage="No teacher reviews have been assigned yet." />
      </section> : null}
      <section>
        <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-black uppercase text-cyan-200">Studies</p><h2 className="text-xl font-black text-white">Saved analysis</h2></div><span className="text-xs text-slate-500">{studies.length} total</span></div>
        {studies.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{studies.map((study) => <Card key={study.id} className="flex min-w-0 flex-col p-4">
          <div className="flex items-start justify-between gap-3"><h3 className="truncate font-black text-white">{study.title}</h3><span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase text-slate-400">{study.accessRole}</span></div>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-400">{study.description || "No description yet."}</p>
          <p className="mt-3 text-xs text-slate-500">{study.chapterCount} chapter{study.chapterCount === 1 ? "" : "s"} · updated {new Date(study.updatedAt).toLocaleDateString()}</p>
          <Button className="mt-4" variant="secondary" href={`${basePath}/studies/${study.id}`}>Open Study</Button>
        </Card>)}</div> : <Card className="p-6 text-sm text-slate-400">No studies yet. Start a blank notebook or add one of your completed games below.</Card>}
      </section>
      <section>
        <div className="mb-3"><p className="text-xs font-black uppercase text-amber-200">Completed games</p><h2 className="text-xl font-black text-white">Review a game</h2></div>
        {games.length ? <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10 bg-slate-950/60">{games.map((game) => <div key={game.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-black text-white">vs {game.opponentName} <span className={game.result === "win" ? "text-emerald-300" : game.result === "loss" ? "text-rose-300" : "text-cyan-300"}>· {game.result}</span></p><p className="mt-1 text-xs text-slate-500">{new Date(game.completedAt).toLocaleString()} · {game.moves.length} plies</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="ghost" href={`${basePath}/play/game/${game.id}/analysis`}>Analyze Game</Button><Button type="button" variant="secondary" onClick={() => setSelectedGame(game)}>Add to Study</Button></div>
        </div>)}</div> : <Card className="p-6 text-sm text-slate-400">Completed internal games will appear here automatically.</Card>}
      </section>
    </>}
    {selectedGame && <AddToStudyDialog gameId={selectedGame.id} gameTitle={`Game vs ${selectedGame.opponentName}`} basePath={basePath} onClose={() => setSelectedGame(null)} />}
  </div>;
}
