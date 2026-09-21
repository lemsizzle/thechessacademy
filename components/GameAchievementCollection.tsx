"use client";
import { useState } from "react";
import { BadgeCard } from "@/components/BadgeCard";
import { achievementBadge, gameAchievements } from "@/lib/badges/gameAchievements/catalog";
import type { GameAchievementEvidence } from "@/lib/badges/gameAchievements/evidence";
import { survivalAdamantiumBadge } from "@/lib/badges/survivalAdamantium";
export type AchievementAward = { badge_id:string;awarded_at:string;achievement_evidence?:GameAchievementEvidence };
export function GameAchievementCollection({ awards,launchedAt }: { awards:AchievementAward[];launchedAt:string|null }) {
  const [group,setGroup]=useState("All");
  const [status,setStatus]=useState("All");
  const [search,setSearch]=useState("");
  const earned=new Map(awards.map(a=>[a.badge_id,a]));
  const count=gameAchievements.filter(a=>earned.has(a.id)).length;
  const filtered=gameAchievements.filter(a=>(group==="All"||a.group===group)&&(status==="All"||(status==="Earned")===earned.has(a.id))&&`${a.name} ${a.requirement}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <section className="rounded-2xl border border-amber-200/25 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 p-5 sm:p-8">
      <p className="text-xs font-black uppercase tracking-widest text-amber-200">Your game. Your discoveries.</p>
      <h2 className="mt-2 text-3xl font-black text-white">Collect remarkable chess moments</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Learn useful tactics, spot unusual patterns, and fill your trophy case. Every badge awards XP and the same number of Academy Coins once. Play your best chess; the curiosities are optional discoveries, not recommended strategies.</p>
      <div className="mt-5 flex items-center gap-4"><span className="shrink-0 text-2xl font-black text-amber-100">{count} / {gameAchievements.length}</span><progress aria-label="Game achievements earned" value={count} max={gameAchievements.length} className="h-3 min-w-0 w-full max-w-sm accent-amber-300" /></div>
      <p className="mt-4 text-xs leading-5 text-slate-400">{launchedAt ? `Games started from ${new Date(launchedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})} count.` : "Unlocking begins when this collection is released."} Completed Academy games from the normal starting position count without takebacks. Linked Lichess games are checked during activity sync; match streaks use Academy games only. Clock badges need recorded move times. Past games and practice boards do not count.</p>
    </section>
    <section aria-label="Survival milestone" className="flex flex-col gap-5 rounded-2xl border border-violet-200/30 bg-violet-300/5 p-5 sm:flex-row sm:items-center">
      <div className="w-36 shrink-0"><BadgeCard badge={survivalAdamantiumBadge} earned={earned.has(survivalAdamantiumBadge.id)} /></div>
      <div><p className="text-xs font-bold uppercase text-violet-200">Survival milestone · {earned.has(survivalAdamantiumBadge.id) ? "Earned" : "Locked"}</p><h2 className="mt-2 text-xl font-black text-white">Adamantium</h2><p className="mt-2 text-sm leading-6 text-slate-300">{survivalAdamantiumBadge.unlockRequirement}</p><p className="mt-2 text-xs text-slate-400">Temporary artwork · Platinum Survival badges now award 500 XP + 500 coins.</p></div>
    </section>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-bold text-slate-200">Find a badge<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search achievements" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3" /></label>
      <label className="text-sm font-bold text-slate-200">Collection<select value={group} onChange={e=>setGroup(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3">{["All",...new Set(gameAchievements.map(a=>a.group))].map(g=><option key={g}>{g}</option>)}</select></label>
      <label className="text-sm font-bold text-slate-200">Progress<select value={status} onChange={e=>setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3">{["All","Earned","Locked"].map(s=><option key={s}>{s}</option>)}</select></label>
    </div>
    <p className="text-sm text-slate-400" role="status">{filtered.length} {filtered.length===1?"achievement":"achievements"}</p>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{filtered.map(a=>{
      const award=earned.get(a.id);
      return <article key={a.id} className="min-w-0 rounded-xl border border-white/10 bg-slate-950 p-3">
        <BadgeCard badge={{...achievementBadge(a),createdAt:award?.awarded_at,achievementEvidence:award?.achievement_evidence}} earned={!!award} />
        {!award && <h3 className="mt-3 text-sm font-black text-white">{a.name}</h3>}
        <p className="mt-2 text-xs font-bold text-cyan-200">{a.group} · {award?"Earned":"Locked"}</p>
        <p className="mt-2 text-xs leading-5 text-slate-300">{a.requirement}</p>
        <p className="mt-3 text-xs font-black text-amber-200">+{a.xp} XP · +{a.xp} coins</p>
      </article>;
    })}</div>
    {!filtered.length && <p className="rounded-xl border border-dashed border-white/20 p-6 text-center text-slate-300">No badges match these filters. Try another collection.</p>}
    <p className="text-xs text-slate-500">Curiosity challenges inspired by <a href="https://rosen-score.vercel.app/" className="underline">Rosen Score</a>. Chess Quest is not affiliated with Eric Rosen.</p>
  </div>;
}
