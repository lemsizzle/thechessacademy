"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { HALLOWEEN_BOTS, HALLOWEEN_START, HALLOWEEN_END, HALLOWEEN_DEADLINE_LABEL, HALLOWEEN_QUEST_TITLE, HALLOWEEN_REWARD, halloweenQuestState, type HalloweenQuestProgress } from "@/lib/quests/halloween";
import { STUDENT_QUEST_REFRESH_EVENT } from "@/lib/studentQuestRefresh";

export function HalloweenQuestCard() {
  const [progress, setProgress] = useState<HalloweenQuestProgress | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/student/seasonal-quest", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProgress(data as HalloweenQuestProgress);
      setNow(Date.now());
    } catch {
      setError("Your Halloween progress couldn't load. Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(STUDENT_QUEST_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(STUDENT_QUEST_REFRESH_EVENT, refresh);
  }, [load]);
  useEffect(() => {
    const boundary = now < Date.parse(HALLOWEEN_START) ? Date.parse(HALLOWEEN_START) : Date.parse(HALLOWEEN_END);
    if (now >= boundary) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(boundary - now + 1, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [now]);
  if (progress?.enabled === false && !progress.completed) return null;
  const state = halloweenQuestState(progress?.completed ?? false, now);
  const wins = progress?.defeatedBotIds.length ?? 0;
  return (
    <Card className="overflow-hidden border-orange-300/30 bg-gradient-to-br from-orange-400/10 to-violet-400/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-orange-100">{HALLOWEEN_QUEST_TITLE}</h2>
        <span className="rounded-full bg-orange-300/15 px-3 py-1 text-xs font-black text-orange-100">
          {state === "completed" ? "Completed!" : state === "active" ? "Automatically active" : state === "expired" ? "Quest ended" : "Coming soon"}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-200">Beat all five Halloween visitors in Play. Wins with hints or takebacks don't count.</p>
      <p className="mt-2 text-sm font-black text-amber-200">{HALLOWEEN_REWARD} XP + {HALLOWEEN_REWARD} coins · One reward for the whole quest</p>
      <p className="mt-1 text-xs text-slate-300">Deadline: {HALLOWEEN_DEADLINE_LABEL}</p>
      {error ? <div className="mt-3" role="alert"><p className="text-sm text-rose-200">{error}</p><Button className="mt-2" variant="secondary" onClick={() => void load()}>Retry</Button></div> : !progress ? <p className="mt-3 text-sm text-slate-400">Loading your saved wins…</p> : <>
        <div className="mt-4 flex justify-between gap-2 text-sm font-black text-white"><span>{wins} / 5 visitors defeated</span><span>{state === "completed" ? "Rewards awarded" : state === "expired" ? "Final progress" : "No activation needed"}</span></div>
        <progress aria-label="Halloween visitors defeated" value={wins} max={5} className="mt-2 h-2 w-full accent-orange-300" />
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {HALLOWEEN_BOTS.map((bot) => {
            const won = progress.defeatedBotIds.includes(bot.id);
            return <li key={bot.id} className="flex items-center gap-2 text-sm text-slate-200"><span className={won ? "text-emerald-300" : "text-slate-500"} aria-label={won ? "Defeated" : "Still to defeat"}>{won ? "✓" : "○"}</span><span>{bot.name} <span className="text-xs text-slate-400">~{bot.rating}</span></span></li>;
          })}
        </ul>
      </>}
      {state === "active" && <Link href="/student/play#computer-game" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-orange-200 px-4 py-2 text-sm font-black text-slate-950 hover:bg-orange-100">Meet the Halloween bots</Link>}
      {state === "completed" && <p className="mt-3 text-sm text-emerald-200">You conquered the Halloween Bot Hunt! Your XP and coins are saved.</p>}
    </Card>
  );
}
