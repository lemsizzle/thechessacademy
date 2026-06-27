import { getXpProgressToNextLevel } from "@/lib/xp";

export function XpBar({ xp }: { xp: number }) {
  const progress = getXpProgressToNextLevel(xp);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span>{xp.toLocaleString()} XP</span>
        <span>{progress.isMaxLevel ? "Max level" : `${progress.neededXp} XP to next level`}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-sky-300/30 bg-slate-900">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200 shadow-[0_0_20px_rgba(56,189,248,0.65)]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
