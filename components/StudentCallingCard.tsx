import { LevelBadge } from "@/components/LevelBadge";
import { getLevelAvatarSymbol, getLevelCardStyle, getLevelFromXp, getLevelTitleFromXp } from "@/lib/xp";

export function StudentCallingCard({
  name,
  classGroup,
  lichessUsername,
  xp,
  size = "compact"
}: {
  name: string;
  classGroup: string;
  lichessUsername?: string;
  xp: number;
  size?: "compact" | "hero";
}) {
  const level = getLevelFromXp(xp);
  const title = getLevelTitleFromXp(xp);
  const style = getLevelCardStyle(level);
  const avatarSymbol = getLevelAvatarSymbol(level);
  const isHero = size === "hero";

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-gradient-to-r ${title.banner} ${style.frame} ${style.trim} ${isHero ? "min-h-36 p-5" : "min-h-28 p-3"}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${style.aura}`} />
      <div className={`absolute inset-0 ${style.patternOpacity} ${style.pattern}`} />
      <div className={style.accent} />
      <div className={style.shine} />
      <div className="absolute left-0 top-0 h-10 w-10 border-l-2 border-t-2 border-white/35" />
      <div className="absolute bottom-0 right-0 h-10 w-10 border-b-2 border-r-2 border-white/25" />
      <div className="absolute right-3 top-3 rounded-md border border-white/15 bg-black/35 px-2 py-1 text-[10px] font-black uppercase text-white/80">
        Rank {style.rank}
      </div>
      <div className="absolute -bottom-8 left-20 h-20 w-44 rotate-[-18deg] border-t border-white/15 bg-white/[0.08]" />
      <div className="relative flex items-center gap-3 pr-14">
        <div className={`${isHero ? "h-20 w-20 text-3xl" : "h-14 w-14 text-2xl"} ${style.avatar} relative flex shrink-0 items-center justify-center border font-black text-white`}>
          <span className="absolute inset-1 rounded-[inherit] border border-white/10" />
          {avatarSymbol}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`${isHero ? "text-3xl" : "text-lg"} truncate font-black uppercase text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]`}>{name}</h3>
            <LevelBadge level={level} />
          </div>
          <p className={`${isHero ? "text-sm" : "text-xs"} mt-1 font-black uppercase tracking-wide ${title.banner.split(" ").find((part) => part.startsWith("text-")) ?? "text-slate-200"}`}>
            {title.name}
          </p>
          <p className={`${isHero ? "text-sm" : "text-xs"} mt-1 truncate text-slate-300`}>
            {classGroup}{lichessUsername ? ` - lichess: ${lichessUsername}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
