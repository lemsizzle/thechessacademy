/** Opens the visitor's email app; no server request or message is sent here. */
export function ContactButton({ compact = false }: { compact?: boolean }) {
  return <a href="mailto:t.lem.sizzle@gmail.com" aria-label="Contact Coach Lem by email" title="Email t.lem.sizzle@gmail.com"
    className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/5 px-2 text-sm font-bold text-cyan-100 hover:bg-cyan-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 sm:px-3">
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></svg>
    <span className={compact ? "hidden sm:inline" : undefined}>Contact</span>
  </a>;
}
