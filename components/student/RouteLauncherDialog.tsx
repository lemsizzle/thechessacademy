"use client";

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

function focusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ));
}

export function useCloseRouteLauncher() {
  const closeLauncher = useContext(RouteLauncherContext);
  if (!closeLauncher) throw new Error("useCloseRouteLauncher must be used inside RouteLauncherDialog.");
  return closeLauncher;
}

export function RouteLauncherDialog({
  id,
  eyebrow,
  title,
  description,
  triggerLabel,
  triggerDescription,
  children
}: {
  id: string;
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

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeLauncher();
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && previouslyFocused !== document.body) previouslyFocused.focus();
      else window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, [closeLauncher, open]);

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = focusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
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
          className="fixed inset-0 z-[100] overflow-hidden bg-slate-950/90 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLauncher();
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <section
              ref={dialogRef}
              id={id}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              aria-describedby={`${id}-description`}
              tabIndex={-1}
              onKeyDown={trapFocus}
              className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border-white/10 bg-slate-950 shadow-[0_28px_110px_rgba(0,0,0,0.75)] outline-none sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-xl sm:border"
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
