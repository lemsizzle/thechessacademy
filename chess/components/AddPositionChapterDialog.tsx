"use client";

import { useState } from "react";
import type { StudyChapter } from "@/chess/analysis/types";
import { Button } from "@/components/Button";

type Mode = "pgn" | "fen";

export function AddPositionChapterDialog({ studyId, onAdded, onClose }: { studyId: string; onAdded: (chapter: StudyChapter) => void; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("pgn");
  const [title, setTitle] = useState("");
  const [pgn, setPgn] = useState("");
  const [fen, setFen] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function addChapter() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/chess/studies/${encodeURIComponent(studyId)}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined, ...(mode === "pgn" ? { pgn } : { initialFen: fen }) })
      });
      const body = await response.json().catch(() => ({})) as { chapter?: StudyChapter; error?: string };
      if (!response.ok || !body.chapter) throw new Error(body.error ?? "The chapter could not be created.");
      onAdded(body.chapter);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The chapter could not be created.");
      setSaving(false);
    }
  }

  const ready = mode === "pgn" ? Boolean(pgn.trim()) : Boolean(fen.trim());

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="add-position-title" className="w-full max-w-2xl rounded-xl border border-cyan-200/25 bg-slate-950 p-5 shadow-2xl">
      <h2 id="add-position-title" className="text-2xl font-black text-white">Add study chapter</h2>
      <p className="mt-1 text-sm text-slate-400">Import an annotated PGN or begin from any legal FEN position.</p>

      <div className="mt-4 flex gap-2" role="group" aria-label="Chapter source">
        <Button type="button" aria-pressed={mode === "pgn"} variant={mode === "pgn" ? "secondary" : "ghost"} onClick={() => { setMode("pgn"); setError(""); }}>Import PGN</Button>
        <Button type="button" aria-pressed={mode === "fen"} variant={mode === "fen" ? "secondary" : "ghost"} onClick={() => { setMode("fen"); setError(""); }}>Start from FEN</Button>
      </div>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-300">Chapter title <span className="font-normal normal-case text-slate-500">(optional)</span>
        <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={mode === "pgn" ? "Uses the PGN event or player names" : "Custom position"} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm font-normal normal-case text-white outline-none focus:border-cyan-200/50" />
      </label>

      {mode === "pgn" ? <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-300">PGN
        <textarea value={pgn} maxLength={200000} onChange={(event) => setPgn(event.target.value)} rows={12} spellCheck={false} placeholder={'[Event "Lesson"]\n[White "Student"]\n[Black "Coach"]\n\n1. e4 e5 (1... c5) 2. Nf3 {Develops a piece.} *'} className="scrollbar-soft mt-1 w-full resize-y rounded-md border border-white/10 bg-slate-900 p-3 font-mono text-xs font-normal normal-case leading-5 text-white outline-none focus:border-cyan-200/50" />
        <span className="mt-1 block font-normal normal-case text-slate-500">Main lines, variations, comments, NAGs, results, and SetUp/FEN headers are preserved.</span>
      </label> : <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-300">FEN
        <input value={fen} maxLength={200} onChange={(event) => setFen(event.target.value)} spellCheck={false} placeholder="8/8/8/8/8/8/4K3/7k w - - 0 1" className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 font-mono text-xs font-normal normal-case text-white outline-none focus:border-cyan-200/50" />
        <span className="mt-1 block font-normal normal-case text-slate-500">The chapter opens on this position with an empty editable move tree.</span>
      </label>}

      {error && <p className="mt-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="button" variant="secondary" disabled={!ready || saving} onClick={() => void addChapter()}>{saving ? "Adding…" : mode === "pgn" ? "Import PGN" : "Create Position"}</Button>
      </div>
    </section>
  </div>;
}
