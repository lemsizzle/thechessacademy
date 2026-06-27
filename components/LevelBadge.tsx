export function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-amber-100">
      Lv {level}
    </span>
  );
}
