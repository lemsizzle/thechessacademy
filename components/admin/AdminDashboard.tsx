import Link from "next/link";
import { getNavigationGroups } from "@/components/navigation";

const shortcuts = [
  { href: "/admin/students", title: "Students", description: "Profiles, games, and rewards", icon: "♟" },
  { href: "/admin/live-games", title: "Watch live", description: "Follow three boards at once", icon: "◉" },
  { href: "/admin/tournaments", title: "Tournaments", description: "Host games and puzzle battles", icon: "♜" },
  { href: "/admin/classes", title: "Classes", description: "Manage your class groups", icon: "♙" }
];

export function AdminDashboard() {
  return <div className="space-y-6">
    <section aria-label="Teacher shortcuts" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {shortcuts.map(item => <Link key={item.href} href={item.href} prefetch={false} className="rounded-xl border border-cyan-200/20 bg-slate-950/70 p-4 transition-colors hover:bg-cyan-200/10 focus-visible:outline focus-visible:outline-cyan-200 sm:p-5">
        <span aria-hidden="true" className="text-2xl text-cyan-200">{item.icon}</span>
        <h2 className="mt-3 font-black text-white sm:text-lg">{item.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
      </Link>)}
    </section>
    <nav aria-label="Activity and puzzle tournaments" className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold text-cyan-200">
      <Link prefetch={false} href="/admin/tournaments/puzzle" className="inline-flex min-h-11 items-center">Puzzle battle tournaments →</Link>
      <Link prefetch={false} href="/admin/activity" className="inline-flex min-h-11 items-center">Recent student activity →</Link>
    </nav>
    <div className="grid gap-4 md:grid-cols-2">{getNavigationGroups("admin").slice(1).map(group => <section key={group.title} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
      <h2 className="mb-2 text-sm font-black text-slate-300">{group.title}</h2>
      <div className="grid grid-cols-2 gap-1">{group.links.map(link => <Link key={link.href} href={link.href} prefetch={false} className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-cyan-200"><span aria-hidden="true">{link.icon}</span>{link.label}</Link>)}</div>
    </section>)}</div>
  </div>;
}
