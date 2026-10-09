"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatStudentUpdateDate, getRecentStudentUpdates, studentUpdateCutoff, studentUpdateDate, type StudentUpdate } from "@/lib/student/whatsNew";

export function StudentUpdateList({ entries }: { entries: readonly StudentUpdate[] }) {
  return entries.length ? <ol className="space-y-4" aria-label="Recent student updates">
    {entries.map((entry, index) => <li key={entry.id} data-update-date={entry.date}>
      {entry.date !== entries[index - 1]?.date ? <p className={`mb-3 pt-4 text-sm font-black text-cyan-100 ${index ? "border-t border-white/10" : ""}`}><time dateTime={entry.date}>{formatStudentUpdateDate(entry.date)}</time></p> : null}
      <p className="text-sm font-bold leading-6 text-white"><span className="font-medium text-slate-400">{entry.category} · </span>{entry.title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{entry.description}</p>
    </li>)}
  </ol> : <p className="py-8 text-sm leading-6 text-slate-300">No new updates in the last two months. Check back for your next adventure!</p>;
}

export default function StudentWhatsNewDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [openedAt] = useState(() => new Date());
  const entries = getRecentStudentUpdates(openedAt);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      event.stopPropagation();
      // Close is the only interactive element in this text-only popup.
      // Keep Tab/Shift+Tab inside it, including browsers that tab to chrome.
      if (event.key === "Tab") { event.preventDefault(); closeButtonRef.current?.focus(); }
    }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/20 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/80">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-slate-950 p-5 sm:px-6">
      <div className="min-w-0">
        <h2 id={titleId} className="text-2xl font-black text-white">What's new</h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-300">Features, badges, avatar items, and quests from the last two months. Latest first.</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{formatStudentUpdateDate(studentUpdateCutoff(openedAt))} – {formatStudentUpdateDate(studentUpdateDate(openedAt))}</p>
      </div>
      <button ref={closeButtonRef} type="button" autoFocus onClick={onClose} aria-label="Close what's new" className="min-h-11 shrink-0 rounded-lg border border-white/15 px-3 text-sm font-bold text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">Close</button>
    </header>
    <div className="px-5 pb-6 sm:px-6"><StudentUpdateList entries={entries} /></div>
  </dialog>;
}
