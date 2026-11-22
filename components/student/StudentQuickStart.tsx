import Link from "next/link";

/** Server-rendered actions stay usable while the profile streams in below. */
export function StudentQuickStart() {
  return <section aria-label="Quick start" className="mb-6 space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <Link href="/student/training?mode=survival" prefetch={false} className="group rounded-2xl border border-cyan-200/25 bg-cyan-300/10 p-4 transition-colors hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 sm:p-6">
        <span aria-hidden="true" className="text-3xl text-cyan-200">♞</span>
        <span className="mt-3 block text-lg font-black text-white sm:text-2xl">Start Survival</span>
        <span className="mt-1 block text-xs text-slate-300 sm:text-sm">Straight to the first puzzle.</span>
      </Link>
      <Link href="/student/play" prefetch={false} className="group rounded-2xl border border-amber-200/25 bg-amber-300/10 p-4 transition-colors hover:bg-amber-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 sm:p-6">
        <span aria-hidden="true" className="text-3xl text-amber-200">♟</span>
        <span className="mt-3 block text-lg font-black text-white sm:text-2xl">Play a bot</span>
        <span className="mt-1 block text-xs text-slate-300 sm:text-sm">Pick an opponent. Make your move.</span>
      </Link>
    </div>
    <nav aria-label="More ways to play" className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold text-slate-300">
      {[['/student/training','All training'],['/student/play/live','Play a classmate'],['/student/quests','Quests'],['/student/avatar','Avatar Store']].map(([href,label]) => <Link key={href} href={href} prefetch={false} className="inline-flex min-h-11 items-center hover:text-cyan-100 focus-visible:outline focus-visible:outline-cyan-200">{label}</Link>)}
    </nav>
  </section>;
}
