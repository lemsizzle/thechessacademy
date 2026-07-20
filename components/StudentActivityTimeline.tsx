"use client";

import type { StudentActivityItem } from "@/lib/studentActivity";

const kindStyles: Record<StudentActivityItem["kind"], { icon: string; className: string }> = {
  xp: { icon: "XP", className: "border-amber-300/35 bg-amber-300/10 text-amber-100" },
  coin: { icon: "C", className: "border-yellow-200/35 bg-yellow-200/10 text-yellow-100" },
  game: { icon: "G", className: "border-cyan-300/35 bg-cyan-300/10 text-cyan-100" },
  puzzle: { icon: "?", className: "border-fuchsia-300/35 bg-fuchsia-300/10 text-fuchsia-100" },
  quest: { icon: "Q", className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" },
  badge: { icon: "B", className: "border-violet-300/35 bg-violet-300/10 text-violet-100" }
};

function formatActivityDate(value?: string) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function StudentActivityTimeline({ items, emptyText = "No recent activity yet." }: { items: StudentActivityItem[]; emptyText?: string }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const style = kindStyles[item.kind];
        return (
          <div key={item.id} className="flex gap-3 rounded-lg border border-white/10 bg-slate-950/55 p-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-black ${style.className}`}>
              {style.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-black text-white">{item.title}</p>
                <p className="text-xs font-bold text-slate-500">{formatActivityDate(item.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-slate-300">{item.detail}</p>
            </div>
          </div>
        );
      })}
      {items.length === 0 && <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{emptyText}</p>}
    </div>
  );
}
