"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { studentGameSubmissions as seedSubmissions } from "@/data/studentSubmissions";
import { createGameSubmission } from "@/lib/submissions/createGameSubmission";
import { getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import type { StudentGameSubmission, StudentUser } from "@/lib/types";
import { useState } from "react";

export function SubmitGameForm({ compact = false }: { compact?: boolean }) {
  const [gameUrl, setGameUrl] = useState("");
  const [playedAs, setPlayedAs] = useState<StudentGameSubmission["playedAs"]>("unknown");
  const [gameType, setGameType] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("Submit a Lichess game for teacher review. This does not award XP automatically.");

  async function getSubmittingUser() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
      const data = await response.json() as { user?: StudentUser };
      if (response.ok && data.user) {
        setCurrentStudentUserRecord(data.user);
        return data.user;
      }
    } catch {
      // Local session mirror remains the development fallback.
    }

    return getCurrentStudentUser();
  }

  async function submit() {
    setMessage("Submitting game...");
    const user = await getSubmittingUser();
    if (!user) {
      setMessage("Log in with Lichess before submitting a game.");
      return;
    }
    const result = createGameSubmission({
      studentId: user.studentId,
      gameUrl,
      playedAs,
      gameType,
      opponentName,
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
        body: JSON.stringify({ type: "game", gameUrl, playedAs, gameType, opponentName, notes })
      });
      const data = await response.json() as { submission?: StudentGameSubmission; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not submit game.");
      submission = data.submission ?? submission;
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Saved locally on this device.` : "Saved locally on this device.");
      return;
    }
    const store = readAdminStore();
    const existing = store.studentGameSubmissions ?? seedSubmissions;
    updateAdminStore({ studentGameSubmissions: [submission, ...existing.filter((item) => item.id !== submission.id)] });
    setGameUrl("");
    setGameType("");
    setOpponentName("");
    setNotes("");
    setMessage("Game submitted for teacher review.");
  }

  return (
    <Card className="p-4">
      {!compact && <h2 className="font-black text-white">Submit Game</h2>}
      <p className="mt-1 text-sm text-slate-300">{message}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400 md:col-span-2">Lichess Game URL
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={gameUrl} onChange={(event) => setGameUrl(event.target.value)} placeholder="https://lichess.org/abcdefgh" />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Played As
          <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={playedAs} onChange={(event) => setPlayedAs(event.target.value as StudentGameSubmission["playedAs"])}>
            <option value="unknown">Unknown</option>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Game Type
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={gameType} onChange={(event) => setGameType(event.target.value)} placeholder="Rapid, Blitz, Tournament..." />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400">Opponent
          <input className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={opponentName} onChange={(event) => setOpponentName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase text-slate-400 md:col-span-2">Notes
          <textarea className="min-h-24 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
      <Button className="mt-4" onClick={submit}>Submit Game</Button>
    </Card>
  );
}
