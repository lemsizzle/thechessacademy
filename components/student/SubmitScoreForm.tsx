"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { studentScoreSubmissions as seedSubmissions } from "@/data/studentSubmissions";
import { getCurrentStudentUser } from "@/lib/auth/getCurrentUser";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { createScoreSubmission } from "@/lib/submissions/createScoreSubmission";
import type { StudentScoreSubmission, TacticTheme } from "@/lib/types";
import { useState } from "react";

const tacticThemes: TacticTheme[] = ["Fork", "Pin", "Skewer", "Discovered Attack", "Double Attack", "Deflection", "Decoy", "Removing the Defender", "Back Rank Mate", "Mate in One"];

export function SubmitScoreForm({ compact = false }: { compact?: boolean }) {
  const [tacticTheme, setTacticTheme] = useState<TacticTheme>("Fork");
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("Submit a puzzle challenge score for teacher review. This does not award XP automatically.");

  async function submit() {
    const user = getCurrentStudentUser();
    if (!user) return;
    const result = createScoreSubmission({
      studentId: user.studentId,
      challengeName: `${tacticTheme} Puzzle Score`,
      tacticTheme,
      score,
      notes
    });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    let submission = result.submission;
    try {
      const response = await fetch("/api/student/submissions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "score", challengeName: `${tacticTheme} Puzzle Score`, tacticTheme, score, notes })
      });
      const data = await response.json() as { submission?: StudentScoreSubmission; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not submit score.");
      submission = data.submission ?? submission;
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Saved locally on this device.` : "Saved locally on this device.");
    }
    const store = readAdminStore();
    const existing = store.studentScoreSubmissions ?? seedSubmissions;
    updateAdminStore({ studentScoreSubmissions: [submission, ...existing.filter((item) => item.id !== submission.id)] });
    setScore(0);
    setNotes("");
    setMessage("Puzzle score submitted for teacher review.");
  }

  return (
    <Card className="p-4">
      {!compact && <h2 className="font-black text-white">Submit Puzzle Score</h2>}
      <p className="mt-1 text-sm text-slate-300">{message}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Tactic Theme
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={tacticTheme} onChange={(event) => setTacticTheme(event.target.value as TacticTheme)}>
            {tacticThemes.map((theme) => <option key={theme}>{theme}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Score
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" type="number" value={score} onChange={(event) => setScore(Math.max(0, Number(event.target.value) || 0))} />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400 md:col-span-2">Comments
          <textarea className="min-h-24 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
      <Button className="mt-4" onClick={submit}>Submit Score</Button>
    </Card>
  );
}
