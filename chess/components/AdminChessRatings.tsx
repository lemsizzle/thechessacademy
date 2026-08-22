"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChessRatingLeaderboardEntry } from "@/chess/rating/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export function AdminChessRatings({ ratings }: { ratings: ChessRatingLeaderboardEntry[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>, studentId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/admin/chess-ratings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId, rating: Number(form.get("rating")), reason: form.get("reason") }) });
      const body = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "Rating could not be updated.");
      setMessage(body.message || "Rating updated."); setEditing(null); router.refresh();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Rating could not be updated."); }
    finally { setPending(false); }
  }

  return <div className="space-y-4">{message ? <p className="rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm font-bold text-cyan-100" role="status">{message}</p> : null}<Card className="overflow-hidden"><div className="border-b border-white/10 p-5"><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Server-authoritative ledger</p><h2 className="mt-1 text-2xl font-black text-white">Student PvP ratings</h2><p className="mt-1 text-sm text-slate-400">Teacher changes require a reason and remain in each student’s rating history.</p></div><ul className="divide-y divide-white/10">{ratings.map((entry) => <li key={entry.studentId} className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-white">#{entry.rank} · {entry.name}</p><p className="mt-1 text-xs text-slate-500">{entry.classGroup} · {entry.wins}–{entry.draws}–{entry.losses} · {entry.ratedGames} rated</p></div><div className="flex items-center gap-3"><strong className="text-2xl font-black text-cyan-100">{entry.rating}</strong><Button type="button" variant="ghost" onClick={() => setEditing(editing === entry.studentId ? null : entry.studentId)}>Adjust</Button></div></div>{editing === entry.studentId ? <form className="mt-4 grid gap-3 rounded-md border border-white/10 bg-white/5 p-4 sm:grid-cols-[140px_1fr_auto]" onSubmit={(event) => void submit(event, entry.studentId)}><label className="text-xs font-bold text-slate-300">New rating<input name="rating" type="number" min={100} max={3000} required defaultValue={entry.rating} className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label><label className="text-xs font-bold text-slate-300">Reason<input name="reason" required minLength={3} maxLength={240} placeholder="Reason for moderation adjustment" className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label><Button type="submit" className="self-end" disabled={pending}>{pending ? "Saving..." : "Save"}</Button></form> : null}</li>)}</ul></Card></div>;
}
