"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisTree, StudyChapter, StudySummary } from "@/chess/analysis/types";
import { Button } from "@/components/Button";

export function AddToStudyDialog({ gameId, gameTitle, analysisTree, basePath, onClose }: {
  gameId: string;
  gameTitle: string;
  analysisTree?: AnalysisTree;
  basePath: "/student" | "/admin";
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState(gameTitle);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "shared">("private");
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [studyId, setStudyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/chess/studies", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as { studies?: StudySummary[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Studies could not be loaded.");
      const editable = (body.studies ?? []).filter((study) => study.accessRole !== "viewer");
      setStudies(editable);
      setStudyId(editable[0]?.id ?? "");
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Studies could not be loaded."));
  }, []);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (mode === "new") {
        const response = await fetch("/api/chess/studies", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceGameId: gameId, title, description, visibility, analysisTree })
        });
        const body = await response.json().catch(() => ({})) as { studyId?: string; chapterId?: string; error?: string };
        if (!response.ok || !body.studyId || !body.chapterId) throw new Error(body.error ?? "Study could not be created.");
        router.push(`${basePath}/studies/${body.studyId}`);
        return;
      }
      if (!studyId) throw new Error("Choose an existing Study.");
      const response = await fetch(`/api/chess/studies/${studyId}/chapters`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceGameId: gameId, title: gameTitle, analysisTree })
      });
      const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
      if (!response.ok || !body.chapter) throw new Error(body.error ?? "Game could not be added to the Study.");
      router.push(`${basePath}/studies/${studyId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Game could not be added to a Study.");
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="add-study-title" className="w-full max-w-lg rounded-xl border border-cyan-200/25 bg-slate-950 p-5 shadow-[0_0_60px_rgba(34,211,238,.2)]">
      <p className="text-xs font-black uppercase text-cyan-200">Chess notebook</p>
      <h2 id="add-study-title" className="mt-1 text-2xl font-black text-white">Add to Study</h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={mode === "new"} onClick={() => setMode("new")} className={`rounded-md border p-3 text-sm font-black ${mode === "new" ? "border-cyan-200 bg-cyan-300/15 text-white" : "border-white/10 bg-white/5 text-slate-300"}`}>Create New Study</button>
        <button type="button" aria-pressed={mode === "existing"} disabled={!studies.length} onClick={() => setMode("existing")} className={`rounded-md border p-3 text-sm font-black disabled:opacity-40 ${mode === "existing" ? "border-cyan-200 bg-cyan-300/15 text-white" : "border-white/10 bg-white/5 text-slate-300"}`}>Existing Study</button>
      </div>
      {mode === "new" ? <div className="mt-4 space-y-3">
        <label className="block text-xs font-bold uppercase text-slate-400">Study name<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2.5 text-sm font-normal normal-case text-white" /></label>
        <label className="block text-xs font-bold uppercase text-slate-400">Description<textarea value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2.5 text-sm font-normal normal-case text-white" /></label>
        <label className="block text-xs font-bold uppercase text-slate-400">Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "shared")} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2.5 text-sm font-normal normal-case text-white"><option value="private">Private</option><option value="shared">Teacher + Student</option></select></label>
      </div> : <label className="mt-4 block text-xs font-bold uppercase text-slate-400">Choose Study<select value={studyId} onChange={(event) => setStudyId(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 p-2.5 text-sm font-normal normal-case text-white">{studies.map((study) => <option key={study.id} value={study.id}>{study.title}</option>)}</select></label>}
      {error && <p className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-2 text-xs text-rose-100">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" disabled={saving || !title.trim() || (mode === "existing" && !studyId)} onClick={() => void submit()}>{saving ? "Saving…" : "Continue"}</Button></div>
    </section>
  </div>;
}
