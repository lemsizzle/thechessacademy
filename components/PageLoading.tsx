import Link from "next/link";

export function PageLoading() {
  return <main className="academy-grid min-h-screen px-4 py-10 text-slate-200">
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="text-sm font-bold text-cyan-200">Chess Quest</Link>
      <p role="status" className="mt-8 text-lg font-bold">Opening your page…</p>
      <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-40 rounded-xl border border-white/10 bg-slate-800/60 motion-safe:animate-pulse" />)}
      </div>
    </div>
  </main>;
}
