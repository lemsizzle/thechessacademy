"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { assessmentLabel, knowledgePercent, type AssessmentSummary } from "@/lib/assessment/types";

type History = { results: Pick<AssessmentSummary, "id" | "version" | "started_at" | "completed_at" | "correct_count">[]; hasMore: boolean; reviewBase: string };
export function ProfileTestResults({ studentId, actionToken }: { studentId: string; actionToken?: string }) {
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    fetch(`/api/student/assessment/history?studentId=${encodeURIComponent(studentId)}&page=${page}`, { cache: "no-store", signal: controller.signal, headers: actionToken ? { "x-admin-action-token": actionToken } : {} })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Test results could not be loaded."); if (!controller.signal.aborted) setData(body); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Test results could not be loaded."); });
    return () => controller.abort();
  }, [studentId, actionToken, page, refresh]);
  return <section id="test-results" aria-label="Test results" className="my-4 rounded-xl border border-cyan-300/20 bg-slate-950/80 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">Test results</h2><p className="mt-1 text-sm text-slate-400">Completed tests, newest first. Compare scores from the same test version.</p></div><Button variant="ghost" onClick={() => setRefresh(value => value + 1)}>Refresh results</Button></div>
    <div className="mt-3" aria-live="polite">
      {error ? <p role="alert" className="text-sm text-rose-200">{error} <Button variant="ghost" onClick={() => setRefresh(value => value + 1)}>Retry</Button></p> : !data ? <p className="text-sm text-slate-300">Loading test results…</p> : !data.results.length ? <p className="text-sm text-slate-300">No completed tests yet.</p> : <ul className="divide-y divide-white/10">{data.results.map(result => <li key={result.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div><p className="font-bold text-white">{assessmentLabel(result.version)} <strong className="ml-2 text-cyan-100">{knowledgePercent(result.correct_count ?? 0)}/100</strong></p><p className="mt-1 text-xs text-slate-400">{new Date(result.completed_at!).toLocaleString()} · {result.correct_count}/30 correct</p></div>
        <Button href={`${data.reviewBase}/${result.id}`} variant="secondary">Open analysis review</Button>
      </li>)}</ul>}
    </div>
    {(page > 1 || data?.hasMore) && <div className="mt-3 flex items-center gap-3"><Button variant="ghost" disabled={page === 1 || !data} onClick={() => setPage(value => value - 1)}>Newer results</Button><span className="text-sm text-slate-400">Page {page}</span><Button variant="ghost" disabled={!data?.hasMore} onClick={() => setPage(value => value + 1)}>Older results</Button></div>}
  </section>;
}
