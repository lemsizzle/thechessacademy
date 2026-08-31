import Link from "next/link";

const PLAY_MODES = [
  { href: "#computer-game", icon: "♟", title: "Computer", detail: "Pick a bot", tone: "text-amber-200" },
  { href: "/student/play/live", icon: "⚡", title: "Live", detail: "Play a classmate", tone: "text-cyan-200" },
  { href: "/student/play/correspondence", icon: "✉", title: "Correspondence", detail: "Three days per move", tone: "text-violet-200" },
  { href: "/student/play/history", icon: "↻", title: "History", detail: "Replay and analyze", tone: "text-emerald-200" }
] as const;

export function PlayModeGrid() {
  return (
    <nav aria-label="Play modes" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {PLAY_MODES.map((mode) => (
        <Link key={mode.title} href={mode.href} className="group flex min-h-24 items-center gap-3 rounded-xl border border-white/10 bg-slate-950/90 p-4 shadow-[0_12px_30px_rgba(2,6,23,.22)] transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70">
          <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-xl ${mode.tone}`}>{mode.icon}</span>
          <span className="min-w-0">
            <span className="block font-black text-white">{mode.title}</span>
            <span className="mt-0.5 block text-xs font-bold text-slate-400">{mode.detail}</span>
          </span>
          <span aria-hidden="true" className="ml-auto text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200">→</span>
        </Link>
      ))}
    </nav>
  );
}
