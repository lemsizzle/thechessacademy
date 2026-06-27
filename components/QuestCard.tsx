import { Card } from "@/components/Card";
import { badges } from "@/data/badges";
import type { Quest } from "@/lib/types";

export function QuestCard({ quest }: { quest: Quest }) {
  const badge = badges.find((item) => item.id === quest.badgeRewardId);
  const status = quest.status.replace("-", " ");
  const isLive = quest.isLive === true && quest.status !== "completed";
  return (
    <Card className={`relative overflow-hidden p-4 ${isLive ? "border-cyan-200/50 shadow-[0_0_34px_rgba(34,211,238,0.24)]" : ""}`}>
      {isLive && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-amber-200 to-fuchsia-300" />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-cyan-200">{isLive ? "Live " : ""}{quest.type === "boss" ? "Boss Quest" : "Weekly Quest"}</p>
          <h3 className="mt-1 font-black text-white">{quest.title}</h3>
        </div>
        <span className={`rounded border px-2 py-1 text-xs capitalize ${isLive ? "border-cyan-200/40 bg-cyan-300/15 text-cyan-50" : "border-white/10 bg-white/5 text-slate-200"}`}>
          {isLive ? "Live" : status}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">{quest.description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-cyan-300/10 px-2 py-1 text-cyan-100">{quest.xpReward} XP</span>
        {badge && <span className="rounded bg-amber-300/10 px-2 py-1 text-amber-100">{badge.name}</span>}
      </div>
    </Card>
  );
}
