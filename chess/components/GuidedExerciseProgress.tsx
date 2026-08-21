"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuidedExerciseProgress as ProgressRow } from "@/chess/analysis/guidedExercises";
import { Card } from "@/components/Card";

type PublishedRow = { id: string; source_chapter_id: string; source_node_id: string; themes: string[]; is_active: boolean };

export function GuidedExerciseProgress({ studyId }: { studyId: string }) {
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [published, setPublished] = useState<PublishedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/chess/studies/${encodeURIComponent(studyId)}/guided-attempts`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { progress?: ProgressRow[]; published?: PublishedRow[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Exercise progress could not be loaded.");
      setProgress(body.progress ?? []);
      setPublished(body.published ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Exercise progress could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [studyId]);

  useEffect(() => { void load(); }, [load]);

  const solved = progress.filter((row) => row.solved).length;
  const activePuzzles = published.filter((row) => row.is_active).length;

  return <Card className="p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase text-violet-200">Teacher reporting</p><h3 className="font-black text-white">Guided exercise progress</h3><p className="mt-1 text-xs text-slate-400">{solved} solved position{solved === 1 ? "" : "s"} · {activePuzzles} published training puzzle{activePuzzles === 1 ? "" : "s"}</p></div>
      <button type="button" disabled={loading} onClick={() => void load()} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button>
    </div>
    {error && <p className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}
    {!loading && !error && !progress.length && <p className="mt-3 text-sm text-slate-400">Student attempts will appear here after an assigned viewer opens an exercise and plays a move.</p>}
    {progress.length > 0 && <div className="scrollbar-soft mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="px-2 py-2">Student</th><th className="px-2 py-2">Position</th><th className="px-2 py-2">Result</th><th className="px-2 py-2">Attempts</th><th className="px-2 py-2">Last activity</th></tr></thead>
        <tbody className="divide-y divide-white/10">{progress.map((row) => <tr key={`${row.studentId}-${row.chapterId}-${row.nodeId}`}>
          <td className="px-2 py-3 font-black text-white">{row.studentName}</td>
          <td className="max-w-xs px-2 py-3"><p className="font-bold text-slate-200">{row.chapterTitle}</p><p className="truncate text-xs text-slate-500" title={row.prompt}>{row.prompt}</p></td>
          <td className="px-2 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-black ${row.solved ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>{row.solved ? row.firstTrySolved ? "First try" : "Solved" : "In progress"}</span></td>
          <td className="px-2 py-3 text-slate-300">{row.totalAttempts} <span className="text-xs text-slate-500">({row.incorrectAttempts} incorrect)</span></td>
          <td className="px-2 py-3 text-xs text-slate-400">{new Date(row.lastAttemptAt).toLocaleString()}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </Card>;
}
