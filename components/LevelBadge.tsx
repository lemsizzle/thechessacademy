import { getLevelTitle } from "@/lib/xp";

export function LevelBadge({ level, showTitle = false }: { level: number; showTitle?: boolean }) {
  const title = getLevelTitle(level).name;
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-amber-100">
      Lv {level}{showTitle ? ` · ${title}` : ""}
    </span>
  );
}
