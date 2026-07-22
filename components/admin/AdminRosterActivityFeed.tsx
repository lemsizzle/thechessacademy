"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { AdminActivityKind, AdminRosterActivityItem } from "@/lib/activity/adminRosterActivity";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const kindLabels: Record<AdminActivityKind, string> = {
  xp: "XP",
  coin: "Coins",
  quest: "Quests",
  badge: "Badges",
  submission: "Submissions",
  game: "Games",
  puzzle: "Puzzles",
  other: "Other"
};

const kindStyles: Record<AdminActivityKind, string> = {
  xp: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  coin: "border-yellow-200/35 bg-yellow-200/10 text-yellow-100",
  quest: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  badge: "border-violet-300/35 bg-violet-300/10 text-violet-100",
  submission: "border-sky-300/35 bg-sky-300/10 text-sky-100",
  game: "border-cyan-300/35 bg-cyan-300/10 text-cyan-100",
  puzzle: "border-fuchsia-300/35 bg-fuchsia-300/10 text-fuchsia-100",
  other: "border-slate-300/25 bg-slate-300/10 text-slate-200"
};

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fieldClass() {
  return "w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60";
}

export function AdminRosterActivityFeed({ items, compact = false }: { items: AdminRosterActivityItem[]; compact?: boolean }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [classGroup, setClassGroup] = useState("All Classes");
  const [kind, setKind] = useState<"all" | AdminActivityKind>("all");
  const classes = useMemo(() => [...new Set(items.map((item) => item.classGroup))].sort((a, b) => a.localeCompare(b)), [items]);
  const kinds = useMemo(() => [...new Set(items.map((item) => item.kind))].sort(), [items]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => (
      (classGroup === "All Classes" || item.classGroup === classGroup)
      && (kind === "all" || item.kind === kind)
      && (!query || `${item.studentName} ${item.title} ${item.detail} ${item.classGroup}`.toLowerCase().includes(query))
    ));
  }, [classGroup, items, kind, search]);

  const feed = compact ? visibleItems.slice(0, 8) : visibleItems;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-black text-white">{compact ? "Recent Student Activity" : "Roster Activity"}</h2>
          <p className="mt-1 text-sm text-slate-400">XP, coins, quests, badges, and submitted work from every student.</p>
        </div>
        <div className="flex gap-2">
          {!compact && (
            <Button variant="ghost" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          )}
          {compact && <Button href="/admin/activity" variant="secondary">View All</Button>}
        </div>
      </div>

      {!compact && (
        <div className="grid gap-3 border-b border-white/10 bg-black/15 p-4 md:grid-cols-[minmax(220px,1fr)_220px_180px]">
          <label className="grid gap-1 text-xs font-bold text-slate-300">Search activity
            <input className={fieldClass()} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, quest, badge, or reason" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Class
            <select className={fieldClass()} value={classGroup} onChange={(event) => setClassGroup(event.target.value)}>
              <option>All Classes</option>
              {classes.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Activity type
            <select className={fieldClass()} value={kind} onChange={(event) => setKind(event.target.value as "all" | AdminActivityKind)}>
              <option value="all">All Activity</option>
              {kinds.map((value) => <option key={value} value={value}>{kindLabels[value]}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="p-4">
        {!compact && <p className="mb-3 text-xs font-bold uppercase text-cyan-100">Showing {feed.length} of {items.length} recent events</p>}
        <div className="space-y-3">
          {feed.map((item) => (
            <article key={item.id} className="flex gap-3 rounded-lg border border-white/10 bg-slate-950/55 p-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-[10px] font-black uppercase ${kindStyles[item.kind]}`}>
                {kindLabels[item.kind].slice(0, 3)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-white">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {item.studentSlug ? (
                        <Link className="font-bold text-cyan-100 hover:text-cyan-50" href={`/admin/students?student=${encodeURIComponent(item.studentSlug)}`}>{item.studentName}</Link>
                      ) : item.studentName}
                      <span> - {item.classGroup}</span>
                    </p>
                  </div>
                  <time className="shrink-0 text-xs font-bold text-slate-500" dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
              </div>
            </article>
          ))}
          {feed.length === 0 && <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300">No activity matches these filters.</p>}
        </div>
      </div>
    </Card>
  );
}
