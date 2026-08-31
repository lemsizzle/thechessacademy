import Link from "next/link";

const PLAY_MODES = [
  { href: "#computer-game", icon: "♟", title: "Computer", label: "Play against a computer", tone: "text-amber-200" },
  { href: "/student/play/live", icon: "⚡", title: "Classmate", label: "Play a classmate", tone: "text-cyan-200" },
  { href: "/student/play/correspondence", icon: "↻", title: "Continue Game", label: "Continue a correspondence game", tone: "text-violet-200" }
] as const;

export function PlayModeGrid() {
  return (
    <nav aria-label="Play modes" className="grid grid-cols-3 gap-2 sm:gap-3">
      {PLAY_MODES.map((mode) => (
        <Link key={mode.title} href={mode.href} aria-label={mode.label} className="group flex min-h-20 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-2 py-3 text-center shadow-[0_12px_30px_rgba(2,6,23,.22)] transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 sm:min-h-24 sm:gap-3 sm:px-4">
          <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-lg sm:size-11 sm:text-xl ${mode.tone}`}>{mode.icon}</span>
          <span className="text-xs font-black leading-tight text-white sm:text-base">{mode.title}</span>
        </Link>
      ))}
    </nav>
  );
}
