"use client";

import { useStudentMenuDestination } from "./StudentMenuNavigation";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";

const RouteLauncherContext = createContext<(() => void) | null>(null);

export function useCloseRouteLauncher() {
  const closeLauncher = useContext(RouteLauncherContext);
  if (!closeLauncher) throw new Error("useCloseRouteLauncher must be used inside RouteLauncherDialog.");
  return closeLauncher;
}

export function RouteLauncherDialog({
  id,
  navigationHref,
  eyebrow,
  title,
  description,
  triggerLabel,
  triggerDescription,
  children
}: {
  id: string;
  navigationHref: string;
  eyebrow: string;
  title: string;
  description: string;
  triggerLabel: string;
  triggerDescription: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeLauncher = useCallback(() => setOpen(false), []);
  useStudentMenuDestination(navigationHref, () => setOpen(true));

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      if (previouslyFocused && previouslyFocused !== document.body) previouslyFocused.focus();
      else window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, [closeLauncher, open]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLauncher();
    }
  }

  return (
    <RouteLauncherContext.Provider value={closeLauncher}>
      <section className="rounded-xl border border-cyan-200/20 bg-slate-950/80 p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{eyebrow}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">{triggerLabel}</h2>
            <p className="mt-1 text-sm text-slate-400">{triggerDescription}</p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-controls={id}
            onClick={() => setOpen(true)}
            className="min-h-11 rounded-lg bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
          >
            Open
          </button>
        </div>
      </section>

      {open ? (
        <div
          className="student-hub-overlay fixed inset-0 z-20 overflow-y-auto bg-slate-950/90 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLauncher();
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <section
              ref={dialogRef}
              id={id}
              role="dialog"
              aria-modal="false"
              aria-labelledby={`${id}-title`}
              aria-describedby={`${id}-description`}
              tabIndex={-1}
              onKeyDown={handleDialogKeyDown}
              className="flex w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-[0_28px_110px_rgba(0,0,0,0.75)] outline-none"
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-cyan-300/10 via-slate-950 to-amber-300/10 px-4 py-4 sm:px-6 sm:py-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{eyebrow}</p>
                  <h2 id={`${id}-title`} className="mt-1 text-2xl font-black text-white sm:text-3xl">{title}</h2>
                  <p id={`${id}-description`} className="mt-1 text-sm text-slate-300">{description}</p>
                </div>
                <button
                  type="button"
                  onClick={closeLauncher}
                  aria-label={`Close ${title.toLowerCase()} window`}
                  className="grid size-10 shrink-0 place-items-center rounded-md border border-white/15 bg-white/5 text-2xl font-black text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  ×
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
            </section>
          </div>
        </div>
      ) : null}
    </RouteLauncherContext.Provider>
  );
}
