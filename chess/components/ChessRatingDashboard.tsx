"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ChessRatingDashboard as Dashboard } from "@/chess/rating/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

type Response = { ok: boolean; dashboard?: Dashboard; error?: string };
const DATE_FORMATTER = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function change(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function ChessRatingDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/student/chess-rating", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as Response;
        if (!response.ok || !body.dashboard) throw new Error(body.error || "Chess ratings could not be loaded.");
        if (active) setDashboard(body.dashboard);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "Chess ratings could not be loaded."));
    return () => { active = false; };
  }, []);

  if (error) return <Card className="p-6 text-sm font-bold text-rose-100"><p role="alert">{error}</p></Card>;
  if (!dashboard) return <Card className="p-6 text-sm text-slate-300">Loading your Academy rating...</Card>;
  const { profile } = dashboard;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 sm:col-span-2">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Academy PvP rating</p>
          <div className="mt-2 flex flex-wrap items-end gap-3"><strong className="text-5xl font-black text-white">{profile.rating}</strong><span className="pb-1 text-sm font-bold text-cyan-100">{profile.band}{profile.provisional ? " · provisional" : ""}</span></div>
          <p className="mt-3 text-sm text-slate-400">Your rating becomes established after 10 rated games. Casual games never change it.</p>
        </Card>
        <Card className="p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Rated record</p><p className="mt-3 text-2xl font-black text-white">{profile.wins}–{profile.draws}–{profile.losses}</p><p className="mt-1 text-xs text-slate-500">Wins · draws · losses</p></Card>
        <Card className="p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Peak rating</p><p className="mt-3 text-2xl font-black text-amber-100">{profile.peakRating}</p><p className="mt-1 text-xs text-slate-500">Across {profile.ratedGames} rated games</p></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-white/10 p-5"><h2 className="text-xl font-black text-white">Academy leaderboard</h2><p className="mt-1 text-sm text-slate-400">Internal rated student-vs-student games only.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Rank</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Rating</th><th className="px-4 py-3">Record</th><th className="px-5 py-3">Games</th></tr></thead><tbody className="divide-y divide-white/10">{dashboard.leaderboard.map((entry) => <tr key={entry.studentId}><td className="px-5 py-3 font-black text-amber-100">#{entry.rank}</td><td className="px-4 py-3"><p className="font-bold text-white">{entry.name}</p><p className="text-xs text-slate-500">{entry.classGroup}</p></td><td className="px-4 py-3 font-black text-cyan-100">{entry.rating}{entry.provisional ? <span className="ml-2 text-[10px] uppercase text-slate-500">prov.</span> : null}</td><td className="px-4 py-3 text-slate-300">{entry.wins}–{entry.draws}–{entry.losses}</td><td className="px-5 py-3 text-slate-400">{entry.ratedGames}</td></tr>)}</tbody></table></div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">Rating history</h2><p className="mt-1 text-sm text-slate-400">Every change has an immutable audit entry.</p></div><Button href="/student/play/live">Play Rated</Button></div>
        {dashboard.events.length ? <ul className="mt-4 divide-y divide-white/10">{dashboard.events.map((event) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-bold text-white">{event.eventType === "game" ? `${event.result ?? "Game"} vs ${event.opponentName ?? "Student"}` : "Teacher adjustment"}</p><p className="mt-1 text-xs text-slate-500">{DATE_FORMATTER.format(new Date(event.createdAt))} · {event.reason}</p>{event.gameId ? <Link href={`/student/play/live/${event.gameId}`} className="mt-1 inline-block text-xs font-bold text-cyan-200 hover:text-cyan-100">Open game</Link> : null}</div><div className="text-right"><strong className={event.ratingChange >= 0 ? "text-emerald-200" : "text-rose-200"}>{change(event.ratingChange)}</strong><p className="text-xs text-slate-500">{event.ratingBefore} → {event.ratingAfter}</p></div></li>)}</ul> : <p className="mt-4 rounded-md border border-dashed border-white/10 p-5 text-sm text-slate-400">Your first rated result will appear here.</p>}
      </Card>
    </div>
  );
}
