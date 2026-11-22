import Link from "next/link";

export function PlayModeGrid() {
  return <nav data-play-options aria-label="Play options" className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-300">
    <span aria-current="page" className="rounded-lg bg-cyan-300/10 px-3 py-2.5 text-cyan-100">Bots</span>
    {[["/student/play/live", "Classmates"], ["/student/play/history", "Game History"], ["/student/play/correspondence", "Correspondence"], ["/student/tournaments", "Tournaments"]].map(([href, label]) =>
      <Link key={href} href={href} prefetch={false} className="inline-flex min-h-11 items-center rounded-lg px-3 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-cyan-200">{label}</Link>)}
  </nav>;
}
